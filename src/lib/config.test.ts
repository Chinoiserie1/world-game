import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = {
  WORLD_APP_ID: "app_abc",
  WORLD_RP_ID: "rp_abc",
  RP_SIGNING_KEY: "0x" + "1".repeat(64),
  AUTH_SECRET: "a".repeat(32),
  GAME_SECRET: "g".repeat(32),
  ADMIN_SECRET: "admin-secret-1234",
  PRIZE_POOL_ADDRESS: "0x000000000000000000000000000000000000dEaD",
};

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const key of [...Object.keys(VALID), "DEMO_MODE", "ENTRY_FEE_USDC"]) vi.stubEnv(key, "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return (await import("./config")).getConfig();
}

describe("getConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("parses a valid environment with defaults", async () => {
    const cfg = await loadConfig({ ...VALID, DEMO_MODE: "true" });
    expect(cfg).toMatchObject({ WORLD_ID_ENV: "production", ENTRY_FEE_USDC: "1", SEASON_ID: 1, DEMO_MODE: true });
  });

  it("defaults demo mode to off", async () => {
    expect((await loadConfig(VALID)).DEMO_MODE).toBe(false);
  });

  it("lists every invalid variable", async () => {
    await expect(loadConfig({ ...VALID, RP_SIGNING_KEY: "", PRIZE_POOL_ADDRESS: "0x123" })).rejects.toThrow(
      /RP_SIGNING_KEY[\s\S]*PRIZE_POOL_ADDRESS|PRIZE_POOL_ADDRESS[\s\S]*RP_SIGNING_KEY/,
    );
  });
});
