import type { ServiceDeps } from "./deps";
import { getMyPlay, type PlayView } from "./rounds";
import { prizePerWinner } from "./claims";
import { entryActionFor } from "./actions";
import { gameCatalog } from "@/lib/games/registry";
import { getClaim, getTopUpStats } from "@/lib/db/ledger";
import { hasRoundCheck } from "@/lib/db/plays";
import { countPlayersByStatus, getPlayer } from "@/lib/db/players";
import { ensureSeason, getPoolUnits, listRounds } from "@/lib/db/seasons";

export interface SeasonOverview {
  readonly season: { id: number; name: string; status: string; entryFeeUnits: string; entryAction: string };
  readonly poolUnits: string;
  readonly topUps: { totalUnits: string; sponsors: number; top: ReadonlyArray<{ address: string; amountUnits: string }> };
  readonly counts: Record<string, number>;
  readonly rounds: ReadonlyArray<{
    id: number;
    number: number;
    gameId: string;
    status: string;
    opensAt: number | null;
    closesAt: number | null;
    title: string;
    tagline: string;
    rules: readonly string[];
  }>;
  readonly me: null | {
    address: string;
    status: string;
    credential: string;
    assurance: string;
    hasSession: boolean;
    /** Opaque World ID session id, needed client-side to prove the same session again. */
    sessionId: string | null;
    eliminatedRound: number | null;
    checkpointPassed: boolean;
    play: PlayView | null;
    claim: null | { amountUnits: string; status: string; txHash: string | null };
    prizeUnits: string | null;
  };
}

export async function getOverview(deps: ServiceDeps, address: string | null): Promise<SeasonOverview> {
  const season = await ensureSeason(deps.db, deps.seasonId, deps.entryFeeUnits, deps.now());
  const [rounds, poolUnits, counts, topUps] = await Promise.all([
    listRounds(deps.db, deps.seasonId),
    getPoolUnits(deps.db, deps.seasonId),
    countPlayersByStatus(deps.db, deps.seasonId),
    getTopUpStats(deps.db, deps.seasonId),
  ]);
  const catalog = new Map(gameCatalog().map((g) => [g.id, g]));
  const openRound = rounds.find((r) => r.status === "open") ?? null;

  const player = address ? await getPlayer(deps.db, deps.seasonId, address) : null;
  let me: SeasonOverview["me"] = null;
  if (player) {
    const claim = await getClaim(deps.db, deps.seasonId, player.address);
    me = {
      address: player.address,
      status: player.status,
      credential: player.credential,
      assurance: player.assurance,
      hasSession: player.sessionId !== null,
      sessionId: player.sessionId,
      eliminatedRound: player.eliminatedRound,
      checkpointPassed: openRound ? await hasRoundCheck(deps.db, openRound.id, player.address) : false,
      play: await getMyPlay(deps, player.address),
      claim: claim ? { amountUnits: claim.amountUnits.toString(), status: claim.status, txHash: claim.txHash } : null,
      prizeUnits: player.status === "winner" ? (await prizePerWinner(deps)).toString() : null,
    };
  }

  return {
    season: {
      id: season.id,
      name: season.name,
      status: season.status,
      entryFeeUnits: season.entryFeeUnits.toString(),
      entryAction: entryActionFor(season.id),
    },
    poolUnits: poolUnits.toString(),
    topUps: {
      totalUnits: topUps.totalUnits.toString(),
      sponsors: topUps.sponsors,
      top: topUps.top.map((t) => ({ address: t.address, amountUnits: t.amountUnits.toString() })),
    },
    counts,
    rounds: rounds.map((r) => {
      const game = catalog.get(r.gameId)!;
      return { ...r, title: game.title, tagline: game.tagline, rules: game.rules };
    }),
    me,
  };
}
