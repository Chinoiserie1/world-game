"use client";

import { IDKitRequestWidget, proofOfHuman, type IDKitResult } from "@worldcoin/idkit";
import { useState } from "react";
import { apiPost, errorMessage } from "@/lib/client/api";
import { feel } from "@/lib/client/haptics";
import { fetchSignedRequest, type SignedRequest } from "@/lib/client/rp";
import { Button, ErrorNote } from "./ui";

interface Props {
  readonly address: string;
  readonly onVerified: () => void;
}

/**
 * Trust moment #1 — season entry. An Orb-backed World ID uniqueness proof,
 * scoped to this season's action and bound (signal) to the player's wallet:
 * one human = one seat.
 */
export function WorldIdEntry({ address, onVerified }: Props) {
  const [request, setRequest] = useState<SignedRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      setRequest(await fetchSignedRequest("entry"));
      setOpen(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOnBackend(result: IDKitResult) {
    try {
      await apiPost("/api/world-id/enter", { result });
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }

  return (
    <div className="space-y-3">
      <Button tone="pink" busy={loading} onClick={start}>
        Verify with World ID
      </Button>
      <p className="text-center text-xs text-muted">Requires an Orb-verified World ID.</p>
      <ErrorNote message={error} />

      {request?.action && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={request.app_id}
          action={request.action}
          rp_context={request.rp_context}
          environment={request.environment}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: address })}
          handleVerify={verifyOnBackend}
          onSuccess={() => {
            feel("success");
            onVerified();
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
