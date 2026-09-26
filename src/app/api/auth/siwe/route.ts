import { cookies } from "next/headers";
import { verifySiweMessage } from "@worldcoin/minikit-js/siwe";
import { z } from "zod";
import { normalizeAddress } from "@/lib/auth/token";
import { SIWE_COOKIE, handle, readJson, startSession } from "@/lib/server/http";
import { ServiceError } from "@/lib/service/deps";

const bodySchema = z.object({
  payload: z.object({
    status: z.string().optional(),
    message: z.string().min(1),
    signature: z.string().min(1),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    version: z.number().optional(),
  }),
});

/** Completes MiniKit walletAuth (SIWE) and opens an app session. */
export async function POST(request: Request) {
  return handle("auth/siwe", async () => {
    const { payload } = await readJson(request, bodySchema);
    const store = await cookies();
    const nonce = store.get(SIWE_COOKIE)?.value;
    if (!nonce) throw new ServiceError("unauthorized", "Sign-in expired, please retry", "nonce_missing");

    const verification = await verifySiweMessage(
      { status: "success", version: payload.version ?? 2, ...payload },
      nonce,
    ).catch((error: unknown) => {
      throw new ServiceError("unauthorized", `Invalid wallet signature: ${String(error)}`, "siwe_invalid");
    });
    if (!verification.isValid) throw new ServiceError("unauthorized", "Invalid wallet signature", "siwe_invalid");

    const address = normalizeAddress(verification.siweMessageData.address ?? payload.address);
    store.delete(SIWE_COOKIE);
    await startSession(address);
    return { address };
  });
}
