"use client";

import { useState } from "react";
import { apiPost, errorMessage } from "@/lib/client/api";
import { feel } from "@/lib/client/haptics";
import { payIntoPool, type PaymentRequest } from "@/lib/client/pay";
import { formatUsdc } from "@/lib/season/prize";
import { Button, ErrorNote } from "./ui";

interface Props {
  readonly feeUnits: string;
  readonly demo: boolean;
  readonly onEntered: () => void;
}

/** Step 3 — pay the USDC entry fee straight into the prize pool with MiniKit `pay`. */
export function PayEntry({ feeUnits, demo, onEntered }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const request = await apiPost<PaymentRequest>("/api/payments/request");
      await payIntoPool({
        request,
        description: `World Game — entry ticket (${formatUsdc(BigInt(request.amountUnits))} USDC)`,
        confirmPath: "/api/payments/confirm",
        demoPath: demo ? "/api/demo/pay" : null,
      });
      feel("success");
      onEntered();
    } catch (e) {
      feel("error");
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button tone="gold" busy={busy} onClick={pay}>
        Pay {formatUsdc(BigInt(feeUnits))} USDC {demo ? "(simulated)" : ""}
      </Button>
      <ErrorNote message={error} />
    </div>
  );
}
