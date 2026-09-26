import { getServiceDeps } from "@/lib/server/deps";
import { handle, requireAddress } from "@/lib/server/http";
import { startPlay } from "@/lib/service/rounds";

export async function POST() {
  return handle("game/start", async () => {
    const address = await requireAddress();
    return startPlay(await getServiceDeps(), address);
  });
}
