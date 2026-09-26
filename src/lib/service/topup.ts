import { ServiceError, type ServiceDeps } from "./deps";
import { requireSeason } from "./rounds";
import { checkPayment, requireOwnPendingPayment, type PaymentRequest, type PaymentVerifier } from "./payments";
import { confirmPayment, createPayment, type Payment } from "@/lib/db/ledger";

/** 1 USDC minimum keeps dust out; 10k USDC maximum per top-up bounds mistakes. */
export const MIN_TOPUP_UNITS = BigInt(1_000_000);
export const MAX_TOPUP_UNITS = BigInt(10_000_000_000);

/**
 * Anyone signed in — player or not — can sponsor the season and grow the prize
 * pool. Top-ups don't grant a seat: seats still require a World ID entry.
 */
export async function requestTopUp(deps: ServiceDeps, address: string, amountUnits: bigint): Promise<PaymentRequest> {
  const season = await requireSeason(deps);
  if (season.status === "finished") throw new ServiceError("forbidden", "This season is over", "season_finished");
  if (amountUnits < MIN_TOPUP_UNITS || amountUnits > MAX_TOPUP_UNITS) {
    throw new ServiceError("invalid", "Top-up must be between 1 and 10,000 USDC", "topup_amount");
  }
  const reference = deps.newId();
  await createPayment(deps.db, { reference, seasonId: deps.seasonId, address, kind: "topup", amountUnits, now: deps.now() });
  return { reference, to: deps.prizePoolAddress, amountUnits: amountUnits.toString() };
}

async function finalizeTopUp(deps: ServiceDeps, payment: Payment, transactionId: string): Promise<{ amountUnits: string }> {
  const confirmed = await confirmPayment(deps.db, payment.reference, transactionId);
  if (!confirmed) throw new ServiceError("conflict", "Payment already used");
  return { amountUnits: payment.amountUnits.toString() };
}

export async function confirmTopUp(
  deps: ServiceDeps,
  address: string,
  input: { reference: string; transactionId: string },
  verifyPayment: PaymentVerifier,
): Promise<{ amountUnits: string }> {
  const payment = await requireOwnPendingPayment(deps, address, input.reference, "topup");
  await checkPayment(deps, payment, input.transactionId, verifyPayment);
  return finalizeTopUp(deps, payment, input.transactionId);
}

/** Demo mode: record the top-up without an on-chain transfer. */
export async function confirmDemoTopUp(deps: ServiceDeps, address: string, reference: string) {
  if (!deps.demoMode) throw new ServiceError("forbidden", "Demo mode is disabled");
  const payment = await requireOwnPendingPayment(deps, address, reference, "topup");
  return finalizeTopUp(deps, payment, `demo_${payment.reference}`);
}
