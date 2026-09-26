import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { passCheckpoint } from "@/lib/service/rounds";

const bodySchema = z.object({ result: z.unknown() });

/** Weekly identity checkpoint before the elimination game. */
export async function POST(request: Request) {
  return handle("world-id/checkpoint", async () => {
    const address = await requireAddress();
    const { result } = await readJson(request, bodySchema);
    await passCheckpoint(await getServiceDeps(), address, result);
    return { checkpointPassed: true };
  });
}
