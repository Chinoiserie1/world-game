import { glassBridge } from "./glass-bridge";
import { minesweeper } from "./minesweeper";
import { minority } from "./minority";
import { rps } from "./rps";
import type { AnyGameEngine, GameId } from "./types";

const ENGINES: Readonly<Record<GameId, AnyGameEngine>> = {
  rps,
  minesweeper,
  "glass-bridge": glassBridge,
  minority,
};

/** One game per week; the last one is the final. */
export const SEASON_GAME_ORDER: readonly GameId[] = ["rps", "minesweeper", "glass-bridge", "minority"];

export function getEngine(id: GameId): AnyGameEngine {
  return ENGINES[id];
}

export function isGameId(value: string): value is GameId {
  return value in ENGINES;
}

export function gameCatalog() {
  return SEASON_GAME_ORDER.map((id, index) => {
    const engine = ENGINES[id];
    return {
      id,
      week: index + 1,
      title: engine.title,
      tagline: engine.tagline,
      rules: engine.rules,
      survival: engine.survival,
    };
  });
}
