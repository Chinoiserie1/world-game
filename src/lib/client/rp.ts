import type { RpContext } from "@worldcoin/idkit";
import { apiPost } from "./api";

export interface SignedRequest {
  readonly app_id: `app_${string}`;
  readonly action: string | null;
  readonly environment: "production" | "staging" | "sandbox";
  readonly rp_context: RpContext;
}

/** Fresh RP signature from our backend — required before every IDKit request. */
export function fetchSignedRequest(kind: "entry" | "session"): Promise<SignedRequest> {
  return apiPost<SignedRequest>("/api/world-id/rp-signature", { kind });
}
