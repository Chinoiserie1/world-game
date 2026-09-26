import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { confirmDemoTopUp } from "@/lib/service/topup";

const bodySchema = z.object({ reference: z.string().min(1).max(64) });

export async function POST(request: Request) {
  return handle("demo/topup", async () => {
    const address = await requireAddress();
    const { reference } = await readJson(request, bodySchema);
    return confirmDemoTopUp(await getServiceDeps(), address, reference);
  });
}
