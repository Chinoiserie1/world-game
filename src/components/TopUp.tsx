"use client";

import { useState } from "react";
import { apiPost, errorMessage, type SeasonResponse } from "@/lib/client/api";
import { feel } from "@/lib/client/haptics";
import { payIntoPool, type PaymentRequest } from "@/lib/client/pay";
import { formatUsdc } from "@/lib/season/prize";
import { Button, Card, ErrorNote, Eyebrow } from "./ui";

const PRESETS = ["5", "10", "25", "100"] as const;

interface Props {
  readonly data: SeasonResponse;
  readonly demo: boolean;
  readonly refresh: () => void;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Sponsors (players or not) can add USDC to the prize pool. It doesn't buy a seat. */
export function TopUp({ data, demo, refresh }: Props) {
  const [amount, setAmount] = useState<string>("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  if (data.season.status === "finished") return null;

  async function topUp() {
    setBusy(true);
    setError(null);
    setThanks(null);
    try {
      const request = await apiPost<PaymentRequest>("/api/topup/request", { amountUsdc: amount });
      await payIntoPool({
        request,
        description: `World Game — prize pool top-up (${formatUsdc(BigInt(request.amountUnits))} USDC)`,
        confirmPath: "/api/topup/confirm",
        demoPath: demo ? "/api/demo/topup" : null,
      });
      feel("success");
      setThanks(`Thanks! +${amount} USDC added to the pool.`);
      refresh();
    } catch (e) {
      feel("error");
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const { topUps } = data;
  return (
    <Card>
      <Eyebrow>Sponsor the pool</Eyebrow>
      <h2 className="font-display mt-2 text-2xl">Make the prize bigger.</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Anyone can top up the prize pool. It all goes to the last humans standing — sponsoring doesn&apos;t buy a seat.
      </p>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className={`rounded-xl border py-2 font-mono text-sm ${amount === preset ? "border-gold text-gold" : "border-line text-muted"}`}
          >
            {preset}
          </button>
        ))}
      </div>
      <label className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
        <span className="sr-only">Amount in USDC</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className="w-full bg-transparent font-mono text-lg outline-none"
        />
        <span className="font-mono text-sm text-muted">USDC</span>
      </label>

      <Button tone="gold" busy={busy} disabled={!/^\d+(\.\d{1,6})?$/.test(amount)} onClick={topUp}>
        Top up {amount || "0"} USDC {demo ? "(simulated)" : ""}
      </Button>
      <ErrorNote message={error} />
      {thanks && <p className="mt-3 text-center text-sm text-teal">{thanks}</p>}

      {topUps.sponsors > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-mono text-xs uppercase text-muted">
            {formatUsdc(BigInt(topUps.totalUnits))} USDC from {topUps.sponsors} sponsor{topUps.sponsors > 1 ? "s" : ""}
          </p>
          <ol className="mt-2 space-y-1 font-mono text-sm">
            {topUps.top.map((s, i) => (
              <li key={s.address} className="flex justify-between">
                <span className="text-muted">
                  {i + 1}. {shortAddress(s.address)}
                </span>
                <span className="text-gold">{formatUsdc(BigInt(s.amountUnits))}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
