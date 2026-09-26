import { z } from "zod";
import { getPaymentVerifier, getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { confirmTopUp } from "@/lib/service/topup";

const bodySchema = z.object({
  reference: z.string().min(1).max(64),
  transactionId: z.string().min(1).max(200),
});

/** Verifies the sponsor's USDC transfer landed in the prize pool. */
export async function POST(request: Request) {
  return handle("topup/confirm", async () => {
    const address = await requireAddress();
    const input = await readJson(request, bodySchema);
    return confirmTopUp(await getServiceDeps(), address, input, getPaymentVerifier());
  });
}
