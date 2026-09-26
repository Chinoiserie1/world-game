import { MiniKit } from "@worldcoin/minikit-js";
import { Tokens } from "@worldcoin/minikit-js/commands";
import { ApiError, apiPost } from "./api";

export interface PaymentRequest {
  readonly reference: string;
  readonly to: string;
  readonly amountUnits: string;
}

const RETRIES = 8;
const RETRY_DELAY_MS = 2_500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Confirms with the backend, retrying while the transfer is still pending on-chain. */
async function confirmWithRetry(confirmPath: string, reference: string, transactionId: string): Promise<void> {
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      await apiPost(confirmPath, { reference, transactionId });
      return;
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "payment_pending")) throw e;
      await wait(RETRY_DELAY_MS);
    }
  }
  throw new Error("Payment still pending — try again in a moment");
}

/**
 * Sends USDC to the prize pool with MiniKit `pay`, then has the backend verify
 * the transfer with the Developer Portal. In demo mode the transfer is simulated.
 */
export async function payIntoPool(opts: {
  request: PaymentRequest;
  description: string;
  confirmPath: string;
  demoPath: string | null;
}): Promise<void> {
  const { request, description, confirmPath, demoPath } = opts;
  if (demoPath) {
    await apiPost(demoPath, { reference: request.reference });
    return;
  }
  const result = await MiniKit.pay({
    reference: request.reference,
    to: request.to,
    tokens: [{ symbol: Tokens.USDC, token_amount: request.amountUnits }],
    description,
  });
  await confirmWithRetry(confirmPath, request.reference, result.data.transactionId);
}
