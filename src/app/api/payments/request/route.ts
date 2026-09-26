import { getServiceDeps } from "@/lib/server/deps";
import { handle, requireAddress } from "@/lib/server/http";
import { requestEntryPayment } from "@/lib/service/entry";

/** Creates a payment reference for MiniKit `pay` (USDC → prize pool). */
export async function POST() {
  return handle("payments/request", async () => {
    const address = await requireAddress();
    return requestEntryPayment(await getServiceDeps(), address);
  });
}
