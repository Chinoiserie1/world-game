"use client";

import type { RpsView, Throw } from "@/lib/games/rps";
import type { BoardProps } from "./types";

const ICON: Record<Throw, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const LABEL: Record<Throw, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
const OUTCOME = { win: "text-teal", loss: "text-pink", draw: "text-muted" } as const;

export function RpsBoard({ view, finished, busy, onMove }: BoardProps<RpsView>) {
  const last = view.throws.at(-1);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-2xl bg-panel-2 px-5 py-4">
        <Score label="You" value={view.playerWins} target={view.winsNeeded} tone="text-teal" />
        <span className="font-display text-2xl text-muted">VS</span>
        <Score label="Master" value={view.houseWins} target={view.winsNeeded} tone="text-pink" />
      </div>

      <div className="flex h-28 items-center justify-center gap-8 text-6xl" aria-live="polite">
        {last ? (
          <>
            <span key={`p${view.throws.length}`} className="animate-pop">{ICON[last.player]}</span>
            <span className={`font-display text-lg uppercase ${OUTCOME[last.outcome]}`}>
              {last.outcome === "win" ? "Win" : last.outcome === "loss" ? "Loss" : "Draw"}
            </span>
            <span key={`h${view.throws.length}`} className="animate-pop">{ICON[last.house]}</span>
          </>
        ) : (
          <span className="text-base text-muted">First to {view.winsNeeded} wins.</span>
        )}
      </div>

      {!finished && (
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(ICON) as Throw[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy}
              onClick={() => onMove({ throw: t })}
              className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-panel-2 py-4 text-4xl transition active:scale-95 disabled:opacity-40"
            >
              {ICON[t]}
              <span className="font-mono text-[11px] uppercase text-muted">{LABEL[t]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Score({ label, value, target, tone }: { label: string; value: number; target: number; tone: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-[11px] uppercase text-muted">{label}</p>
      <p className={`font-display text-4xl ${tone}`}>
        {value}
        <span className="text-lg text-muted">/{target}</span>
      </p>
    </div>
  );
}
