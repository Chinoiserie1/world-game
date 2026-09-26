import { signRequest } from "@worldcoin/idkit/signing";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { handle, readJson, requireAddress } from "@/lib/server/http";
import { entryActionFor } from "@/lib/service/actions";

const bodySchema = z.object({ kind: z.enum(["entry", "session"]) });

/**
 * Signs an IDKit request server-side. Entry (uniqueness) requests are bound to
 * the season action; session requests carry no action, per World ID 4.0.
 */
export async function POST(request: Request) {
  return handle("world-id/rp-signature", async () => {
    await requireAddress();
    const { kind } = await readJson(request, bodySchema);
    const cfg = getConfig();
    const action = kind === "entry" ? entryActionFor(cfg.SEASON_ID) : undefined;
    const sig = signRequest({ signingKeyHex: cfg.RP_SIGNING_KEY, action });
    return {
      app_id: cfg.WORLD_APP_ID,
      action: action ?? null,
      environment: cfg.WORLD_ID_ENV,
      rp_context: {
        rp_id: cfg.WORLD_RP_ID,
        nonce: sig.nonce,
        created_at: sig.createdAt,
        expires_at: sig.expiresAt,
        signature: sig.sig,
      },
    };
  });
}
