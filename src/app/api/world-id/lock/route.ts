import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { lockIdentity } from "@/lib/service/identity";

const bodySchema = z.object({ result: z.unknown() });

/** Binds a World ID session to the season entry (re-proved every week). */
export async function POST(request: Request) {
  return handle("world-id/lock", async () => {
    const address = await requireAddress();
    const { result } = await readJson(request, bodySchema);
    const player = await lockIdentity(await getServiceDeps(), address, result);
    return { hasSession: player.sessionId !== null };
  });
}
