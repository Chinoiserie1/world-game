import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SIWE_COOKIE, handle } from "@/lib/server/http";

/** Issues a SIWE nonce (alphanumeric, ≥ 8 chars) bound to an httpOnly cookie. */
export async function GET() {
  return handle("auth/nonce", async () => {
    const nonce = randomBytes(16).toString("hex");
    const store = await cookies();
    store.set(SIWE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return { nonce };
  });
}
