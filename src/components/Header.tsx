import type { SeasonResponse } from "@/lib/client/api";
import { formatUsdc } from "@/lib/season/prize";
import { Shapes } from "./ui";

export function Header({ data }: { data: SeasonResponse }) {
  const alive = data.counts.alive + data.counts.winner;
  const out = data.counts.eliminated;
  return (
    <header className="space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-wide">
          WORLD<span className="text-pink">GAME</span>
        </h1>
        <Shapes className="text-pink" />
      </div>
      <div className="rounded-3xl border border-line bg-panel p-5 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted">Prize pool · {data.season.name}</p>
        <p className="font-display text-5xl text-gold">
          {formatUsdc(BigInt(data.poolUnits))} <span className="text-2xl">USDC</span>
        </p>
        <div className="mt-3 flex justify-center gap-6 font-mono text-sm">
          <span>
            <span className="text-teal">{alive}</span> alive
          </span>
          <span>
            <span className="text-pink">{out}</span> eliminated
          </span>
        </div>
      </div>
    </header>
  );
}
