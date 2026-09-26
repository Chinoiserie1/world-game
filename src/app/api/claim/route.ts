import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { getPayoutSender } from "@/lib/server/payout";
import { claimPrize } from "@/lib/service/claims";

const bodySchema = z.object({ result: z.unknown().nullable().default(null) });

/** Winners re-prove their World ID session, then the pool pays out on World Chain. */
export async function POST(request: Request) {
  return handle("claim", async () => {
    const address = await requireAddress();
    const { result } = await readJson(request, bodySchema);
    const claim = await claimPrize(await getServiceDeps(), address, result ?? null, getPayoutSender());
    return { amountUnits: claim.amountUnits.toString(), status: claim.status, txHash: claim.txHash };
  });
}
