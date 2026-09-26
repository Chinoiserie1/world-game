import { ServiceError, type ServiceDeps } from "./deps";
import { proveSameHuman, requirePlayer } from "./identity";
import { getEngine } from "@/lib/games/registry";
import { commitmentFor, deriveSeed } from "@/lib/games/rng";
import { GameError, type AnyGameEngine } from "@/lib/games/types";
import { createPlay, getPlay, hasRoundCheck, recordRoundCheck, savePlayState, type Play } from "@/lib/db/plays";
import { getPlayer } from "@/lib/db/players";
import { getSeason, listRounds, type Round } from "@/lib/db/seasons";
import type { SeasonPlayer } from "@/lib/db/players";

export interface PlayView {
  readonly playId: string;
  readonly gameId: string;
  readonly commitment: string;
  /** Revealed only once the play is over, so the player can re-derive everything. */
  readonly seed: string | null;
  readonly finished: boolean;
  readonly score: number;
  readonly view: unknown;
}

export async function getOpenRound(deps: ServiceDeps): Promise<Round | null> {
  const rounds = await listRounds(deps.db, deps.seasonId);
  return rounds.find((r) => r.status === "open") ?? null;
}

async function requireOpenRound(deps: ServiceDeps): Promise<Round> {
  const round = await getOpenRound(deps);
  if (!round) throw new ServiceError("forbidden", "No game is running right now", "no_open_round");
  if (round.closesAt !== null && deps.now() > round.closesAt) {
    throw new ServiceError("forbidden", "This week's game is closed", "round_closed");
  }
  return round;
}

async function requireAlivePlayer(deps: ServiceDeps, address: string): Promise<SeasonPlayer> {
  const player = await requirePlayer(deps, address);
  if (player.status === "eliminated") throw new ServiceError("forbidden", "You have been eliminated", "eliminated");
  if (player.status !== "alive") throw new ServiceError("forbidden", "Join the game first", "not_entered");
  return player;
}

export function toPlayView(play: Play, engine: AnyGameEngine, now: number): PlayView {
  const finished = play.status === "finished" || engine.isFinished(play.state, now);
  return {
    playId: play.id,
    gameId: engine.id,
    commitment: play.commitment,
    seed: finished ? play.seed : null,
    finished,
    score: engine.score(play.state),
    view: engine.view(play.state, now),
  };
}

/**
 * Weekly identity checkpoint: before playing, the player proves their saved
 * World ID session — the same human who entered, not a bot or a bought account.
 */
export async function passCheckpoint(deps: ServiceDeps, address: string, idkitResult: unknown): Promise<void> {
  const round = await requireOpenRound(deps);
  const player = await requireAlivePlayer(deps, address);
  if (!player.sessionId) throw new ServiceError("forbidden", "No World ID session on file", "session_required");
  await proveSameHuman(deps, player, idkitResult);
  await recordRoundCheck(deps.db, round.id, address, deps.now());
}

export async function passDemoCheckpoint(deps: ServiceDeps, address: string): Promise<void> {
  if (!deps.demoMode) throw new ServiceError("forbidden", "Demo mode is disabled");
  const round = await requireOpenRound(deps);
  const player = await requireAlivePlayer(deps, address);
  if (player.assurance !== "demo") throw new ServiceError("forbidden", "Real players must prove their World ID");
  await recordRoundCheck(deps.db, round.id, address, deps.now());
}

export async function startPlay(deps: ServiceDeps, address: string): Promise<PlayView> {
  const round = await requireOpenRound(deps);
  await requireAlivePlayer(deps, address);
  if (!(await hasRoundCheck(deps.db, round.id, address))) {
    throw new ServiceError("forbidden", "Pass the identity checkpoint first", "checkpoint_required");
  }
  const engine = getEngine(round.gameId);
  const existing = await getPlay(deps.db, round.id, address);
  if (existing) return toPlayView(existing, engine, deps.now());

  const id = deps.newId();
  const seed = deriveSeed(deps.gameSecret, id);
  const now = deps.now();
  const created = await createPlay(deps.db, {
    id,
    roundId: round.id,
    address,
    seed,
    commitment: commitmentFor(seed),
    state: engine.init({ seed, now }),
    now,
  });
  const play = created ?? (await getPlay(deps.db, round.id, address));
  if (!play) throw new Error("Play creation failed");
  return toPlayView(play, engine, now);
}

export async function playMove(deps: ServiceDeps, address: string, rawMove: unknown): Promise<PlayView> {
  const round = await requireOpenRound(deps);
  await requireAlivePlayer(deps, address);
  const play = await getPlay(deps.db, round.id, address);
  if (!play) throw new ServiceError("not_found", "Start the game first", "no_play");
  if (play.status === "finished") throw new ServiceError("conflict", "You already finished this game", "play_finished");

  const engine = getEngine(round.gameId);
  const now = deps.now();
  let nextState: unknown;
  try {
    nextState = engine.applyMove(play.state, engine.parseMove(rawMove), { seed: play.seed, now });
  } catch (error) {
    if (error instanceof GameError) throw new ServiceError("invalid", error.message, "illegal_move");
    throw error;
  }

  const finished = engine.isFinished(nextState, now);
  const saved = await savePlayState(deps.db, play, {
    state: nextState,
    finished,
    score: engine.score(nextState),
    choice: engine.choice?.(nextState) ?? null,
    now,
  });
  if (!saved) throw new ServiceError("conflict", "Another move was processed first, refresh", "stale_state");
  const updated = await getPlay(deps.db, round.id, address);
  if (!updated) throw new Error("Play vanished");
  return toPlayView(updated, engine, now);
}

export async function getMyPlay(deps: ServiceDeps, address: string): Promise<PlayView | null> {
  const round = await getOpenRound(deps);
  if (!round) return null;
  const player = await getPlayer(deps.db, deps.seasonId, address);
  if (!player) return null;
  const play = await getPlay(deps.db, round.id, address);
  return play ? toPlayView(play, getEngine(round.gameId), deps.now()) : null;
}

export async function requireSeason(deps: ServiceDeps) {
  const season = await getSeason(deps.db, deps.seasonId);
  if (!season) throw new ServiceError("not_found", "Season not found");
  return season;
}
