import "server-only";
import { randomUUID } from "node:crypto";
import { getConfig } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { ensureSeason } from "@/lib/db/seasons";
import { verifyEntryPayment } from "@/lib/payments/verify";
import type { PaymentVerifier } from "@/lib/service/entry";
import type { ServiceDeps } from "@/lib/service/deps";
import { usdcToUnits } from "@/lib/season/prize";

let seasonReady: Promise<unknown> | null = null;

export async function getServiceDeps(): Promise<ServiceDeps> {
  const cfg = getConfig();
  const db = await getDb();
  const entryFeeUnits = usdcToUnits(cfg.ENTRY_FEE_USDC);
  seasonReady ??= ensureSeason(db, cfg.SEASON_ID, entryFeeUnits, Date.now()).catch((error: unknown) => {
    seasonReady = null;
    throw error;
  });
  await seasonReady;
  return {
    db,
    now: () => Date.now(),
    newId: () => randomUUID().replace(/-/g, ""),
    seasonId: cfg.SEASON_ID,
    entryFeeUnits,
    prizePoolAddress: cfg.PRIZE_POOL_ADDRESS.toLowerCase(),
    gameSecret: cfg.GAME_SECRET,
    worldId: { rpId: cfg.WORLD_RP_ID, environment: cfg.WORLD_ID_ENV },
    demoMode: cfg.DEMO_MODE,
  };
}

export function getPaymentVerifier(): PaymentVerifier {
  const cfg = getConfig();
  return async (transactionId, expected) => {
    if (!cfg.DEV_PORTAL_API_KEY) throw new Error("DEV_PORTAL_API_KEY is not configured");
    return verifyEntryPayment(transactionId, expected, { appId: cfg.WORLD_APP_ID, apiKey: cfg.DEV_PORTAL_API_KEY });
  };
}
