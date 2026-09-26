"use client";

import { useState } from "react";
import type { GlassBridgeView } from "@/lib/games/glass-bridge";
import type { MinesweeperView } from "@/lib/games/minesweeper";
import type { MinorityView } from "@/lib/games/minority";
import type { RpsView } from "@/lib/games/rps";
import { apiPost, errorMessage, type PlayView } from "@/lib/client/api";
import { feel } from "@/lib/client/haptics";
import { Fairness } from "./Fairness";
import { GlassBridgeBoard } from "./games/GlassBridgeBoard";
import { MinesweeperBoard } from "./games/MinesweeperBoard";
import { MinorityBoard } from "./games/MinorityBoard";
import { RpsBoard } from "./games/RpsBoard";
import { Button, ErrorNote } from "./ui";

interface Props {
  readonly initial: PlayView | null;
  readonly onChange: () => void;
}

/** Starts (or resumes) this week's play and routes moves to the server-authoritative engine. */
export function GameBoard({ initial, onChange }: Props) {
  const [play, setPlay] = useState<PlayView | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const next = await apiPost<PlayView>(path, body);
      setPlay(next);
      feel(next.finished ? "warning" : "tap");
      if (next.finished) onChange();
    } catch (e) {
      feel("error");
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!play) {
    return (
      <div className="space-y-3">
        <Button tone="pink" busy={busy} onClick={() => run("/api/game/start")}>
          Start the game
        </Button>
        <ErrorNote message={error} />
      </div>
    );
  }

  const onMove = (move: Record<string, unknown>) => run("/api/game/move", { move });
  const common = { finished: play.finished, busy, onMove };

  return (
    <div className="space-y-4">
      {play.gameId === "rps" && <RpsBoard view={play.view as RpsView} {...common} />}
      {play.gameId === "minesweeper" && <MinesweeperBoard view={play.view as MinesweeperView} {...common} />}
      {play.gameId === "glass-bridge" && <GlassBridgeBoard view={play.view as GlassBridgeView} {...common} />}
      {play.gameId === "minority" && <MinorityBoard view={play.view as MinorityView} {...common} />}
      <ErrorNote message={error} />
      {play.finished && play.gameId !== "minority" && (
        <p className="text-center text-sm text-muted">
          Score recorded: <span className="text-ink">{play.score}</span>. Verdict when the week closes.
        </p>
      )}
      <Fairness commitment={play.commitment} seed={play.seed} />
    </div>
  );
}
