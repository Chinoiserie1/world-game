import { z } from "zod";
import type { FetchLike } from "@/lib/worldid/verify";

export const TRANSACTION_URL = "https://developer.world.org/api/v2/minikit/transaction";

export class PaymentError extends Error {
  constructor(
    readonly code: "pending" | "failed" | "mismatch" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

const transactionSchema = z
  .object({
    reference: z.string(),
    transaction_hash: z.string().optional(),
    transaction_status: z.enum(["pending", "mined", "failed"]),
    from: z.string(),
    to: z.string(),
    token: z.string(),
    token_amount: z.string(),
  })
  .loose();

export interface ExpectedPayment {
  readonly reference: string;
  readonly to: string;
  readonly amountUnits: bigint;
  readonly from: string;
}

export interface PaymentCheckContext {
  readonly appId: string;
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
}

/** USDC.e symbol as reported by World App ("USDCE") — also accept "USDC". */
const USDC_SYMBOLS = new Set(["USDCE", "USDC", "USDC.E"]);

/**
 * Confirms a MiniKit `pay` transaction with the Developer Portal: right
 * reference, right receiver (prize pool), right token, full amount, mined.
 */
export async function verifyEntryPayment(
  transactionId: string,
  expected: ExpectedPayment,
  ctx: PaymentCheckContext,
): Promise<{ transactionHash: string | null }> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const url = `${TRANSACTION_URL}/${encodeURIComponent(transactionId)}?app_id=${encodeURIComponent(ctx.appId)}&type=payment`;
  let response: Response;
  try {
    response = await doFetch(url, { method: "GET", headers: { Authorization: `Bearer ${ctx.apiKey}` } });
  } catch (error) {
    throw new PaymentError("unavailable", `Developer Portal unreachable: ${String(error)}`);
  }
  if (!response.ok) throw new PaymentError("unavailable", `Developer Portal returned ${response.status}`);

  const parsed = transactionSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new PaymentError("unavailable", "Unexpected transaction payload");
  const tx = parsed.data;

  if (tx.reference !== expected.reference) throw new PaymentError("mismatch", "Payment reference mismatch");
  if (tx.to.toLowerCase() !== expected.to.toLowerCase()) throw new PaymentError("mismatch", "Payment sent to the wrong address");
  if (tx.from.toLowerCase() !== expected.from.toLowerCase()) {
    throw new PaymentError("mismatch", "Payment sent from another wallet");
  }
  if (!USDC_SYMBOLS.has(tx.token.toUpperCase())) throw new PaymentError("mismatch", "Payment must be in USDC");
  if (BigInt(tx.token_amount) < expected.amountUnits) throw new PaymentError("mismatch", "Payment amount too low");
  if (tx.transaction_status === "failed") throw new PaymentError("failed", "Payment failed on-chain");
  if (tx.transaction_status === "pending") throw new PaymentError("pending", "Payment is still pending");

  return { transactionHash: tx.transaction_hash ?? null };
}
