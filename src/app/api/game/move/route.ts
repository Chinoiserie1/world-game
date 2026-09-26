import { z } from "zod";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { playMove } from "@/lib/service/rounds";

const bodySchema = z.object({ move: z.record(z.string(), z.unknown()) });

export async function POST(request: Request) {
  return handle("game/move", async () => {
    const address = await requireAddress();
    const { move } = await readJson(request, bodySchema);
    return playMove(await getServiceDeps(), address, move);
  });
}
