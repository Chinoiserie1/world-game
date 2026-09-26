import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { getServiceDeps } from "@/lib/server/deps";
import { handle, readJson } from "@/lib/server/http";
import { WEEK_MS, closeOpenRound, openNextRound } from "@/lib/service/admin";
import { ServiceError } from "@/lib/service/deps";

const bodySchema = z.object({
  action: z.enum(["open", "close"]),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 14).optional(),
});

function assertAdmin(request: Request): void {
  const provided = Buffer.from(request.headers.get("x-admin-secret") ?? "");
  const expected = Buffer.from(getConfig().ADMIN_SECRET);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new ServiceError("unauthorized", "Admin secret required");
  }
}

/** Game master controls: open next weekly game / close it and eliminate. */
export async function POST(request: Request) {
  return handle("admin/round", async () => {
    assertAdmin(request);
    const { action, durationMinutes } = await readJson(request, bodySchema);
    const deps = await getServiceDeps();
    if (action === "open") return openNextRound(deps, durationMinutes ? durationMinutes * 60_000 : WEEK_MS);
    return closeOpenRound(deps);
  });
}
