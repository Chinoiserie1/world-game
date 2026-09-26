import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { registerHuman } from "@/lib/service/identity";

const bodySchema = z.object({ result: z.unknown() });

/** Verifies the season-entry uniqueness proof (1 human = 1 seat). */
export async function POST(request: Request) {
  return handle("world-id/enter", async () => {
    const address = await requireAddress();
    const { result } = await readJson(request, bodySchema);
    const player = await registerHuman(await getServiceDeps(), address, result);
    return { status: player.status, credential: player.credential, assurance: player.assurance };
  });
}
