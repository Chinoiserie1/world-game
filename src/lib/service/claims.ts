import { ServiceError, type ServiceDeps } from "./deps";
import { proveSameHuman, requirePlayer } from "./identity";
import { requireSeason } from "./rounds";
import { createClaim, getClaim, markClaimPaid, type Claim } from "@/lib/db/ledger";
import { listPlayersByStatus } from "@/lib/db/players";
import { getPoolUnits } from "@/lib/db/seasons";
import { splitPrize } from "@/lib/season/prize";

/** Sends the on-chain payout (PrizePool.payout); injected so it can be disabled or mocked. */
export type PayoutSender = (to: string, amountUnits: bigint, claimKey: string) => Promise<string>;

export async function prizePerWinner(deps: ServiceDeps): Promise<bigint> {
  const winners = await listPlayersByStatus(deps.db, deps.seasonId, "winner");
  const pool = await getPoolUnits(deps.db, deps.seasonId);
  return splitPrize(pool, winners.length).perWinner;
}

/**
 * Final trust moment: before money moves, the winner proves once more that
 * they are the human who entered (same World ID session).
 */
export async function claimPrize(
  deps: ServiceDeps,
  address: string,
  idkitResult: unknown | null,
  sendPayout: PayoutSender | null,
): Promise<Claim> {
  const season = await requireSeason(deps);
  if (season.status !== "finished") throw new ServiceError("forbidden", "The season is not over yet");
  const player = await requirePlayer(deps, address);
  if (player.status !== "winner") throw new ServiceError("forbidden", "Only survivors can claim", "not_winner");
  if (await getClaim(deps.db, deps.seasonId, address)) throw new ServiceError("conflict", "Prize already claimed");

  if (player.assurance === "demo") {
    if (!deps.demoMode) throw new ServiceError("forbidden", "Demo mode is disabled");
  } else {
    if (idkitResult === null) throw new ServiceError("invalid", "World ID proof required", "proof_required");
    await proveSameHuman(deps, player, idkitResult);
  }

  const amountUnits = await prizePerWinner(deps);
  const created = await createClaim(deps.db, { seasonId: deps.seasonId, address, amountUnits, now: deps.now() });
  if (!created) throw new ServiceError("conflict", "Prize already claimed");

  if (sendPayout && player.assurance !== "demo" && amountUnits > BigInt(0)) {
    const txHash = await sendPayout(address, amountUnits, `s${deps.seasonId}:${address}`);
    await markClaimPaid(deps.db, deps.seasonId, address, txHash);
  }
  const claim = await getClaim(deps.db, deps.seasonId, address);
  if (!claim) throw new Error("Claim vanished");
  return claim;
}
