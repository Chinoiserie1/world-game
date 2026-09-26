import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { createToken, readToken } from "@/lib/auth/token";
import { ServiceError } from "@/lib/service/deps";
import { createRateLimiter } from "./rate-limit";

export const SESSION_COOKIE = "wg_session";
export const SIWE_COOKIE = "wg_siwe";
const SESSION_TTL_S = 7 * 24 * 60 * 60;

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code?: string;
}

export function ok<T>(data: T, status = 200): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function fail(status: number, error: string, code?: string): NextResponse<ApiEnvelope<null>> {
  return NextResponse.json({ success: false, data: null, error, code }, { status });
}

/** Converts any thrown error into a safe JSON envelope; logs unexpected ones server-side. */
export function toErrorResponse(error: unknown): NextResponse<ApiEnvelope<null>> {
  if (error instanceof ServiceError) return fail(error.status, error.message, error.reason ?? error.code);
  if (error instanceof z.ZodError) return fail(400, "Invalid request body", "invalid_body");
  console.error("[api] unexpected error", error);
  return fail(500, "Something went wrong, please retry", "internal_error");
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await request.json().catch(() => {
    throw new ServiceError("invalid", "Body must be JSON");
  });
  return schema.parse(body);
}

export async function getSessionAddress(): Promise<string | null> {
  const store = await cookies();
  const payload = readToken(store.get(SESSION_COOKIE)?.value, getConfig().AUTH_SECRET, Math.floor(Date.now() / 1000));
  return payload?.address ?? null;
}

export async function requireAddress(): Promise<string> {
  const address = await getSessionAddress();
  if (!address) throw new ServiceError("unauthorized", "Sign in with your wallet first", "unauthorized");
  return address;
}

export async function startSession(address: string): Promise<void> {
  const store = await cookies();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  store.set(SESSION_COOKIE, createToken({ address, exp }, getConfig().AUTH_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

const limiter = createRateLimiter(60, 60_000);

/** Rate limits by client IP + route; throws a 429-mapped error. */
export async function rateLimit(route: string): Promise<void> {
  const h = await headers();
  // Behind Vercel these headers are set by the platform; self-hosting needs a trusted proxy that overwrites them.
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!limiter.check(`${route}:${ip}`, Date.now())) {
    throw new ServiceError("rate_limited", "Too many requests, slow down", "rate_limited");
  }
}

/** Wraps a route body with rate limiting + uniform error handling. */
export async function handle<T>(route: string, body: () => Promise<T>): Promise<NextResponse> {
  try {
    await rateLimit(route);
    return ok(await body());
  } catch (error) {
    return toErrorResponse(error);
  }
}
