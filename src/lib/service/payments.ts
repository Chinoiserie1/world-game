import { ServiceError, type ServiceDeps } from "./deps";
import { getPayment, type Payment, type PaymentKind } from "@/lib/db/ledger";
import { PaymentError, type ExpectedPayment } from "@/lib/payments/verify";

/** Checks a MiniKit payment against the Developer Portal (injected for tests). */
export type PaymentVerifier = (transactionId: string, expected: ExpectedPayment) => Promise<unknown>;

export interface PaymentRequest {
  readonly reference: string;
  readonly to: string;
  readonly amountUnits: string;
}

/** The reference must belong to this wallet, this season, this kind of payment, and still be pending. */
export async function requireOwnPendingPayment(
  deps: ServiceDeps,
  address: string,
  reference: string,
  kind: PaymentKind,
): Promise<Payment> {
  const payment = await getPayment(deps.db, reference);
  if (!payment || payment.address !== address || payment.seasonId !== deps.seasonId || payment.kind !== kind) {
    throw new ServiceError("not_found", "Unknown payment reference");
  }
  if (payment.status !== "pending") throw new ServiceError("conflict", "Payment already confirmed");
  return payment;
}

/** Verifies the transfer landed in the prize pool; maps verifier failures to user-facing errors. */
export async function checkPayment(
  deps: ServiceDeps,
  payment: Payment,
  transactionId: string,
  verifyPayment: PaymentVerifier,
): Promise<void> {
  try {
    await verifyPayment(transactionId, {
      reference: payment.reference,
      to: deps.prizePoolAddress,
      amountUnits: payment.amountUnits,
      from: payment.address,
    });
  } catch (error) {
    if (!(error instanceof PaymentError)) throw error;
    if (error.code === "pending") throw new ServiceError("pending", "Payment pending, retrying…", "payment_pending");
    if (error.code === "unavailable") throw new ServiceError("unavailable", error.message, "payment_unavailable");
    throw new ServiceError("invalid", error.message, "payment_invalid");
  }
}
