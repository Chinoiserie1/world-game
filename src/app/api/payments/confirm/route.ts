import { z } from "zod";
import { getPaymentVerifier, getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { confirmEntryPayment } from "@/lib/service/entry";

const bodySchema = z.object({
  reference: z.string().min(1).max(64),
  transactionId: z.string().min(1).max(200),
});

/** Verifies the USDC transfer with the Developer Portal, then enters the player. */
export async function POST(request: Request) {
  return handle("payments/confirm", async () => {
    const address = await requireAddress();
    const input = await readJson(request, bodySchema);
    const player = await confirmEntryPayment(await getServiceDeps(), address, input, getPaymentVerifier());
    return { status: player.status };
  });
}
