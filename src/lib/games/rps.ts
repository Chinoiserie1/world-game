import { z } from "zod";
import { parseWith } from "./parse";
import { randomInt } from "./rng";
import { GameError, type GameEngine } from "./types";

export const THROWS = ["rock", "paper", "scissors"] as const;
export type Throw = (typeof THROWS)[number];
export type Outcome = "win" | "loss" | "draw";

const WINS_NEEDED = 3;
const MAX_THROWS = 15;

const BEATS: Record<Throw, Throw> = { rock: "scissors", paper: "rock", scissors: "paper" };

export interface RpsState {
  readonly throws: ReadonlyArray<{ readonly player: Throw; readonly house: Throw }>;
}

export interface RpsMove {
  readonly throw: Throw;
}

export interface RpsView {
  readonly throws: ReadonlyArray<{ player: Throw; house: Throw; outcome: Outcome }>;
  readonly playerWins: number;
  readonly houseWins: number;
  readonly winsNeeded: number;
  readonly finished: boolean;
}

const moveSchema = z.object({ throw: z.enum(THROWS) });

export function outcomeOf(player: Throw, house: Throw): Outcome {
  if (player === house) return "draw";
  return BEATS[player] === house ? "win" : "loss";
}

/** The house throw for turn `index` is fixed by the committed seed. */
export function houseThrow(seed: string, index: number): Throw {
  return THROWS[randomInt(seed, `rps:${index}`, THROWS.length)];
}

function tally(state: RpsState): { playerWins: number; houseWins: number } {
  return state.throws.reduce(
    (acc, t) => {
      const outcome = outcomeOf(t.player, t.house);
      if (outcome === "win") return { ...acc, playerWins: acc.playerWins + 1 };
      if (outcome === "loss") return { ...acc, houseWins: acc.houseWins + 1 };
      return acc;
    },
    { playerWins: 0, houseWins: 0 },
  );
}

function finished(state: RpsState): boolean {
  const { playerWins, houseWins } = tally(state);
  return playerWins >= WINS_NEEDED || houseWins >= WINS_NEEDED || state.throws.length >= MAX_THROWS;
}

export const rps: GameEngine<RpsState, RpsMove, RpsView> = {
  id: "rps",
  title: "Rock · Paper · Scissors",
  tagline: "Beat the Game Master — first to 3 wins.",
  rules: [
    "First to 3 wins against the Game Master.",
    "The Master's throws are committed (hashed) BEFORE you pick — no cheating possible.",
    "Win the duel to survive the week.",
  ],
  survival: { type: "threshold", minScore: 1 },

  init: () => ({ throws: [] }),

  parseMove: (raw) => parseWith(moveSchema, raw),

  applyMove(state, move, ctx) {
    if (finished(state)) throw new GameError("Match already finished");
    const house = houseThrow(ctx.seed, state.throws.length);
    return { throws: [...state.throws, { player: move.throw, house }] };
  },

  isFinished: (state) => finished(state),

  score(state) {
    return tally(state).playerWins >= WINS_NEEDED ? 1 : 0;
  },

  view(state) {
    const { playerWins, houseWins } = tally(state);
    return {
      throws: state.throws.map((t) => ({ ...t, outcome: outcomeOf(t.player, t.house) })),
      playerWins,
      houseWins,
      winsNeeded: WINS_NEEDED,
      finished: finished(state),
    };
  },
};
