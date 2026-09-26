"use client";

import type { MinorityOption, MinorityView } from "@/lib/games/minority";
import type { BoardProps } from "./types";

const STYLE: Record<MinorityOption, { label: string; className: string }> = {
  red: { label: "Red", className: "bg-pink text-white" },
  blue: { label: "Blue", className: "bg-[#2e6bff] text-white" },
};

export function MinorityBoard({ view, busy, onMove }: BoardProps<MinorityView>) {
  if (view.pick) {
    return (
      <div className="space-y-3 text-center">
        <div className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full font-display text-2xl uppercase ${STYLE[view.pick].className}`}>
          {STYLE[view.pick].label}
        </div>
        <p className="text-muted">Choice locked. The minority side is revealed when the week closes.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      {view.options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={busy}
          onClick={() => onMove({ pick: option })}
          className={`aspect-square rounded-3xl font-display text-2xl uppercase transition active:scale-95 disabled:opacity-40 ${STYLE[option].className}`}
        >
          {STYLE[option].label}
        </button>
      ))}
    </div>
  );
}
