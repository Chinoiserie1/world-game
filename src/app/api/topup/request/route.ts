import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { usdcToUnits } from "@/lib/season/prize";
import { requestTopUp } from "@/lib/service/topup";

const bodySchema = z.object({ amountUsdc: z.string().regex(/^\d{1,5}(\.\d{1,6})?$/, "Invalid USDC amount") });

/** Creates a payment reference for a sponsor top-up of the prize pool. */
export async function POST(request: Request) {
  return handle("topup/request", async () => {
    const address = await requireAddress();
    const { amountUsdc } = await readJson(request, bodySchema);
    return requestTopUp(await getServiceDeps(), address, usdcToUnits(amountUsdc));
  });
}
