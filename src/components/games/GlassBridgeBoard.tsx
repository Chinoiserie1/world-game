"use client";

import type { GlassBridgeView, Side } from "@/lib/games/glass-bridge";
import type { BoardProps } from "./types";

export function GlassBridgeBoard({ view, finished, busy, onMove }: BoardProps<GlassBridgeView>) {
  const rows = Array.from({ length: view.steps }, (_, i) => view.steps - 1 - i);
  return (
    <div className="space-y-4">
      <p className="text-center font-mono text-sm text-muted">
        Row <span className="text-teal">{view.position}</span> / {view.steps}
      </p>
      <div className="mx-auto flex max-w-[220px] flex-col gap-1.5">
        <div className="rounded-md bg-teal/20 py-1 text-center font-mono text-[11px] uppercase text-teal">Finish</div>
        {rows.map((step) => (
          <div key={step} className="grid grid-cols-2 gap-2">
            {(["left", "right"] as Side[]).map((side) => (
              <Panel key={side} step={step} side={side} view={view} />
            ))}
          </div>
        ))}
        <div className="rounded-md bg-panel-2 py-1 text-center font-mono text-[11px] uppercase text-muted">Start</div>
      </div>

      {!finished && (
        <div className="grid grid-cols-2 gap-3">
          {(["left", "right"] as Side[]).map((side) => (
            <button
              key={side}
              type="button"
              disabled={busy}
              onClick={() => onMove({ side })}
              className="rounded-2xl border border-line bg-panel-2 py-4 font-display text-lg uppercase active:scale-95 disabled:opacity-40"
            >
              {side === "left" ? "← Left" : "Right →"}
            </button>
          ))}
        </div>
      )}
      {finished && (
        <p className="text-center font-display text-xl">{view.fell ? "The glass broke." : "You made it across!"}</p>
      )}
    </div>
  );
}

function Panel({ step, side, view }: { step: number; side: Side; view: GlassBridgeView }) {
  const chosen = view.choices[step] === side;
  const brokeHere = view.fell && step === view.choices.length - 1 && chosen;
  const isCurrent = !view.finished && step === view.position;
  const tempered = view.path?.[step] === side;

  let style = "border-line bg-panel-2/60";
  if (isCurrent) style = "border-gold/70 bg-gold/10";
  if (view.path && tempered) style = "border-teal/50 bg-teal/15";
  if (chosen) style = "border-teal bg-teal/40";
  if (brokeHere) style = "border-danger bg-danger/40 animate-shake";

  return <div className={`h-6 rounded-sm border ${style}`} aria-label={`row ${step + 1} ${side}`} />;
}
