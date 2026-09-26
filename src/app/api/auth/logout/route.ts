import { cookies } from "next/headers";
import { SESSION_COOKIE, handle } from "@/lib/server/http";

export async function POST() {
  return handle("auth/logout", async () => {
    (await cookies()).delete(SESSION_COOKIE);
    return { signedOut: true };
  });
}
