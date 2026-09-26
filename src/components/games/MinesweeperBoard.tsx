"use client";

import { useEffect, useState } from "react";
import type { MinesweeperView } from "@/lib/games/minesweeper";
import type { BoardProps } from "./types";

const NUMBER_COLORS = ["", "text-teal", "text-gold", "text-pink", "text-pink", "text-danger", "text-danger", "text-danger", "text-danger"];

function useCountdown(deadline: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function MinesweeperBoard({ view, finished, busy, onMove }: BoardProps<MinesweeperView>) {
  const [flagMode, setFlagMode] = useState(false);
  const [flags, setFlags] = useState<ReadonlySet<number>>(new Set());
  const started = view.cells.some((c) => c !== "hidden");
  const seconds = useCountdown(view.deadline, started && !finished);
  const revealed = view.cells.filter((c) => typeof c === "number").length;

  function tap(index: number) {
    if (finished || busy || view.cells[index] !== "hidden") return;
    if (flagMode) {
      setFlags((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
      return;
    }
    if (!flags.has(index)) onMove({ index });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between font-mono text-sm">
        <span>💣 {view.mines}</span>
        <span className="text-teal">{revealed} cleared</span>
        <span className={seconds < 30 && started ? "text-pink" : ""}>
          ⏱ {started ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "3:00"}
        </span>
      </div>

      <div className={`grid gap-1 ${view.exploded !== null ? "animate-shake" : ""}`} style={{ gridTemplateColumns: `repeat(${view.size}, 1fr)` }}>
        {view.cells.map((cell, i) => {
          const hidden = cell === "hidden";
          const flagged = hidden && flags.has(i);
          return (
            <button
              key={i}
              type="button"
              aria-label={`cell ${i}`}
              onClick={() => tap(i)}
              className={`aspect-square rounded-md font-display text-base transition ${
                cell === "mine"
                  ? i === view.exploded
                    ? "bg-danger"
                    : "bg-pink/30"
                  : hidden
                    ? "bg-panel-2 active:scale-90 border border-line"
                    : "bg-bg"
              } ${typeof cell === "number" ? NUMBER_COLORS[cell] : ""}`}
            >
              {cell === "mine" ? "✹" : flagged ? "⚑" : typeof cell === "number" && cell > 0 ? cell : ""}
            </button>
          );
        })}
      </div>

      {!finished && (
        <button
          type="button"
          onClick={() => setFlagMode((m) => !m)}
          className={`w-full rounded-xl border py-2 font-mono text-sm uppercase ${flagMode ? "border-gold text-gold" : "border-line text-muted"}`}
        >
          {flagMode ? "⚑ Flag mode on" : "⚑ Place flags"}
        </button>
      )}
      {finished && (
        <p className="text-center font-display text-xl">
          {view.won ? "Board cleared! +10" : view.exploded !== null ? "BOOM." : "Time's up."}
        </p>
      )}
    </div>
  );
}
