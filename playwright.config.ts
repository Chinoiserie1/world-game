import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["iPhone 13"], browserName: "chromium" },
  webServer: {
    command: `rm -f data/e2e.db && pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/api/season`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      WORLD_APP_ID: "app_staging_e2e",
      NEXT_PUBLIC_WORLD_APP_ID: "app_staging_e2e",
      WORLD_RP_ID: "rp_e2e",
      RP_SIGNING_KEY: `0x${"ab".repeat(32)}`,
      WORLD_ID_ENV: "staging",
      PRIZE_POOL_ADDRESS: "0x000000000000000000000000000000000000dEaD",
      AUTH_SECRET: "e".repeat(64),
      GAME_SECRET: "f".repeat(64),
      ADMIN_SECRET: "e2e-admin-secret",
      DATABASE_URL: "file:./data/e2e.db",
      DEMO_MODE: "true",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
