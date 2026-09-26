import { ServiceError, type ServiceDeps } from "./deps";
import { requirePlayer } from "./identity";
import { checkPayment, requireOwnPendingPayment, type PaymentRequest, type PaymentVerifier } from "./payments";
import { confirmPayment, createPayment } from "@/lib/db/ledger";
import { getPlayer, markEntered, type SeasonPlayer } from "@/lib/db/players";

export type { PaymentRequest, PaymentVerifier } from "./payments";

async function requireReadyToPay(deps: ServiceDeps, address: string): Promise<SeasonPlayer> {
  const player = await requirePlayer(deps, address);
  if (player.status !== "verified") throw new ServiceError("conflict", "You already joined the game", "already_entered");
  if (!player.sessionId) throw new ServiceError("forbidden", "Lock your World ID session first", "session_required");
  return player;
}

/** Step 3a — create a one-time payment reference for MiniKit `pay`. */
export async function requestEntryPayment(deps: ServiceDeps, address: string): Promise<PaymentRequest> {
  await requireReadyToPay(deps, address);
  const reference = deps.newId();
  await createPayment(deps.db, {
    reference,
    seasonId: deps.seasonId,
    address,
    kind: "entry",
    amountUnits: deps.entryFeeUnits,
    now: deps.now(),
  });
  return { reference, to: deps.prizePoolAddress, amountUnits: deps.entryFeeUnits.toString() };
}

async function finalizeEntry(deps: ServiceDeps, address: string, reference: string, transactionId: string) {
  const confirmed = await confirmPayment(deps.db, reference, transactionId);
  if (!confirmed) throw new ServiceError("conflict", "Payment already used");
  await markEntered(deps.db, deps.seasonId, address, deps.now());
  const player = await getPlayer(deps.db, deps.seasonId, address);
  if (!player) throw new Error("Player vanished");
  return player;
}

/** Step 3b — verify the USDC transfer landed in the prize pool, then enter. */
export async function confirmEntryPayment(
  deps: ServiceDeps,
  address: string,
  input: { reference: string; transactionId: string },
  verifyPayment: PaymentVerifier,
): Promise<SeasonPlayer> {
  await requireReadyToPay(deps, address);
  const payment = await requireOwnPendingPayment(deps, address, input.reference, "entry");
  await checkPayment(deps, payment, input.transactionId, verifyPayment);
  return finalizeEntry(deps, address, payment.reference, input.transactionId);
}

/** Demo mode: record the entry without an on-chain transfer. */
export async function confirmDemoPayment(deps: ServiceDeps, address: string, reference: string) {
  if (!deps.demoMode) throw new ServiceError("forbidden", "Demo mode is disabled");
  await requireReadyToPay(deps, address);
  const payment = await requireOwnPendingPayment(deps, address, reference, "entry");
  return finalizeEntry(deps, address, payment.reference, `demo_${payment.reference}`);
}
