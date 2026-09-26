import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { confirmDemoPayment } from "@/lib/service/entry";

const bodySchema = z.object({ reference: z.string().min(1).max(64) });

export async function POST(request: Request) {
  return handle("demo/pay", async () => {
    const address = await requireAddress();
    const { reference } = await readJson(request, bodySchema);
    const player = await confirmDemoPayment(await getServiceDeps(), address, reference);
    return { status: player.status };
  });
}
