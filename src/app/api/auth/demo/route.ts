import { randomBytes } from "node:crypto";
import { getConfig } from "@/lib/config";
import { handle, startSession } from "@/lib/server/http";
import { ServiceError } from "@/lib/service/deps";

/** Demo mode only: sign in with a throwaway wallet so the game can be tried in any browser. */
export async function POST() {
  return handle("auth/demo", async () => {
    if (!getConfig().DEMO_MODE) throw new ServiceError("forbidden", "Demo mode is disabled");
    const address = `0x${randomBytes(20).toString("hex")}`;
    await startSession(address);
    return { address };
  });
}
