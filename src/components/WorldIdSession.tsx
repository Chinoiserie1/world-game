"use client";

import { CredentialRequest, IDKitSessionWidget, type IDKitResultSession } from "@worldcoin/idkit";
import { useState } from "react";
import { apiPost, errorMessage } from "@/lib/client/api";
import { feel } from "@/lib/client/haptics";
import { fetchSignedRequest, type SignedRequest } from "@/lib/client/rp";
import { Button, ErrorNote } from "./ui";

interface Props {
  /** Backend route that verifies the session proof. */
  readonly endpoint: "/api/world-id/lock" | "/api/world-id/checkpoint" | "/api/claim";
  /** Existing session to prove; null creates the session (identity lock). */
  readonly sessionId: string | null;
  readonly label: string;
  readonly tone?: "pink" | "teal" | "gold";
  readonly onDone: () => void;
}

const ORB_CONSTRAINT = CredentialRequest("proof_of_human");

/**
 * World ID 4.0 session proofs: created once at entry, then proven again at each
 * weekly checkpoint and at prize claim — the same human must show up every time.
 */
export function WorldIdSession({ endpoint, sessionId, label, tone = "teal", onDone }: Props) {
  const [request, setRequest] = useState<SignedRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      setRequest(await fetchSignedRequest("session"));
      setOpen(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOnBackend(result: IDKitResultSession) {
    try {
      await apiPost(endpoint, { result });
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }

  return (
    <div className="space-y-3">
      <Button tone={tone} busy={loading} onClick={start}>
        {label}
      </Button>
      <ErrorNote message={error} />
      {request && (
        <IDKitSessionWidget
          open={open}
          onOpenChange={setOpen}
          app_id={request.app_id}
          rp_context={request.rp_context}
          environment={request.environment}
          constraints={ORB_CONSTRAINT}
          {...(sessionId ? { existing_session_id: sessionId as `session_${string}` } : {})}
          handleVerify={verifyOnBackend}
          onSuccess={() => {
            feel("success");
            onDone();
          }}
          onError={(code) => {
            feel("error");
            setError((current) => current ?? `World ID verification cancelled (${code})`);
          }}
        />
      )}
    </div>
  );
}
