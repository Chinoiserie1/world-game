import { getServiceDeps } from "@/lib/server/deps";
import { handle, requireAddress } from "@/lib/server/http";
import { registerDemoHuman } from "@/lib/service/identity";

export async function POST() {
  return handle("demo/verify", async () => {
    const address = await requireAddress();
    const player = await registerDemoHuman(await getServiceDeps(), address);
    return { status: player.status };
  });
}
