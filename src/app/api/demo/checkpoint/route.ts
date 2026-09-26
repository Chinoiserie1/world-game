import { getServiceDeps } from "@/lib/server/deps";
import { handle, requireAddress } from "@/lib/server/http";
import { passDemoCheckpoint } from "@/lib/service/rounds";

export async function POST() {
  return handle("demo/checkpoint", async () => {
    const address = await requireAddress();
    await passDemoCheckpoint(await getServiceDeps(), address);
    return { checkpointPassed: true };
  });
}
