import { ServiceError, type ServiceDeps } from "./deps";
import { getOpenRound, requireSeason } from "./rounds";
import { getEngine } from "@/lib/games/registry";
import { listPlays } from "@/lib/db/plays";
import { crownWinners, eliminatePlayers, listPlayersByStatus } from "@/lib/db/players";
import { listRounds, markRoundClosed, openRound, setSeasonStatus, type Round } from "@/lib/db/seasons";
import { decideSurvivors, type EliminationOutcome } from "@/lib/season/elimination";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Opens the next weekly game. Registrations close when week 1 opens. */
export async function openNextRound(deps: ServiceDeps, durationMs = WEEK_MS): Promise<Round> {
  const season = await requireSeason(deps);
  if (season.status === "finished") throw new ServiceError("conflict", "Season is finished");
  if (await getOpenRound(deps)) throw new ServiceError("conflict", "A round is already open");

  const next = (await listRounds(deps.db, deps.seasonId)).find((r) => r.status === "upcoming");
  if (!next) throw new ServiceError("conflict", "No upcoming round left");

  if (season.status === "registration") {
    const alive = await listPlayersByStatus(deps.db, deps.seasonId, "alive");
    if (alive.length === 0) throw new ServiceError("conflict", "Nobody has entered yet");
    await setSeasonStatus(deps.db, deps.seasonId, "active");
  }
  const now = deps.now();
  await openRound(deps.db, next.id, now, now + durationMs);
  return { ...next, status: "open", opensAt: now, closesAt: now + durationMs };
}

export interface CloseRoundResult extends EliminationOutcome {
  readonly round: number;
  readonly seasonFinished: boolean;
}

/** Closes the open round and eliminates everyone who did not survive it. */
export async function closeOpenRound(deps: ServiceDeps): Promise<CloseRoundResult> {
  const round = await getOpenRound(deps);
  if (!round) throw new ServiceError("conflict", "No open round to close");

  // Close first so no move can land after the results snapshot below.
  await markRoundClosed(deps.db, round.id);

  const engine = getEngine(round.gameId);
  const alive = await listPlayersByStatus(deps.db, deps.seasonId, "alive");
  const plays = await listPlays(deps.db, round.id);
  const outcome = decideSurvivors(
    engine.survival,
    alive.map((p) => p.address),
    plays.map((play) => ({
      address: play.address,
      score: engine.score(play.state),
      choice: engine.choice?.(play.state) ?? null,
    })),
  );

  await eliminatePlayers(deps.db, deps.seasonId, outcome.eliminated, round.number);

  const rounds = await listRounds(deps.db, deps.seasonId);
  const seasonFinished = rounds.every((r) => r.status === "closed") || outcome.survivors.length === 0;
  if (seasonFinished) {
    await crownWinners(deps.db, deps.seasonId, outcome.survivors);
    await setSeasonStatus(deps.db, deps.seasonId, "finished");
  }
  return { ...outcome, round: round.number, seasonFinished };
}
