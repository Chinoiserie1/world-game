import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal signed session token: base64url(payload).base64url(hmac).
 * Stored in an httpOnly cookie after a verified SIWE (walletAuth) sign-in.
 */

export interface SessionPayload {
  readonly address: string;
  readonly exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createToken(payload: SessionPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function readToken(token: string | undefined, secret: string, now: number): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Partial<SessionPayload>;
    if (typeof payload.address !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return { address: payload.address, exp: payload.exp };
  } catch {
    return null;
  }
}

export function normalizeAddress(address: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Invalid wallet address");
  return address.toLowerCase();
}
