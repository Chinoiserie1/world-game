import { getConfig } from "@/lib/config";
import { getServiceDeps } from "@/lib/server/deps";
import { getSessionAddress, handle } from "@/lib/server/http";
import { getOverview } from "@/lib/service/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle("season", async () => {
    const deps = await getServiceDeps();
    const viewer = await getSessionAddress();
    const overview = await getOverview(deps, viewer);
    const cfg = getConfig();
    return {
      ...overview,
      viewer,
      config: {
        appId: cfg.WORLD_APP_ID,
        rpId: cfg.WORLD_RP_ID,
        environment: cfg.WORLD_ID_ENV,
        prizePoolAddress: cfg.PRIZE_POOL_ADDRESS,
        demoMode: cfg.DEMO_MODE,
      },
    };
  });
}
