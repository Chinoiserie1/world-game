import "server-only";
import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const serverSchema = z.object({
  WORLD_APP_ID: z.string().regex(/^app_[a-zA-Z0-9_]+$/, "WORLD_APP_ID must look like app_xxx"),
  WORLD_RP_ID: z.string().regex(/^rp_[a-zA-Z0-9_]+$/, "WORLD_RP_ID must look like rp_xxx"),
  RP_SIGNING_KEY: z.string().min(32, "RP_SIGNING_KEY is required (server-only secret)"),
  WORLD_ID_ENV: z.enum(["production", "staging", "sandbox"]).default("production"),
  DEV_PORTAL_API_KEY: z.string().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  GAME_SECRET: z.string().min(32, "GAME_SECRET must be at least 32 chars"),
  ADMIN_SECRET: z.string().min(16, "ADMIN_SECRET must be at least 16 chars"),
  DATABASE_URL: z.string().default("file:./data/world-game.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  PRIZE_POOL_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "PRIZE_POOL_ADDRESS must be an address"),
  ENTRY_FEE_USDC: z.string().regex(/^\d+(\.\d{1,6})?$/).default("1"),
  SEASON_ID: z.coerce.number().int().positive().default(1),
  /** Enables demo sign-in and simulated payments for judging outside World App. */
  DEMO_MODE: boolFromEnv,
  OPERATOR_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  WORLDCHAIN_RPC_URL: z.url().optional(),
});

export type ServerConfig = z.infer<typeof serverSchema>;

let cached: ServerConfig | null = null;

function emptyToUndefined(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]));
}

/** Validates env once; throws a readable error listing every missing variable. */
export function getConfig(): ServerConfig {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(emptyToUndefined(process.env));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

