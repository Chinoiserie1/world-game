import { z } from "zod";
import { parseWith } from "./parse";
import { GameError, type GameEngine } from "./types";

export const OPTIONS = ["red", "blue"] as const;
export type MinorityOption = (typeof OPTIONS)[number];

export interface MinorityState {
  readonly pick: MinorityOption | null;
}

export interface MinorityMove {
  readonly pick: MinorityOption;
}

export interface MinorityView {
  readonly options: readonly MinorityOption[];
  readonly pick: MinorityOption | null;
  readonly finished: boolean;
}

const moveSchema = z.object({ pick: z.enum(OPTIONS) });

/**
 * The final: each human secretly picks a side, only the smaller group survives.
 * This is the game where Sybil resistance matters most — a player with many
 * accounts could otherwise steer the majority and guarantee a win.
 */
export const minority: GameEngine<MinorityState, MinorityMove, MinorityView> = {
  id: "minority",
  title: "Minority Game",
  tagline: "Red or Blue? Only the less-picked side survives.",
  rules: [
    "Pick Red or Blue. Your choice is final and secret.",
    "When the week closes, only the minority side survives (a tie = everyone survives).",
    "1 human = 1 vote: World ID stops anyone from flooding the vote with fake accounts.",
  ],
  survival: { type: "minority" },

  init: () => ({ pick: null }),

  parseMove: (raw) => parseWith(moveSchema, raw),

  applyMove(state, move) {
    if (state.pick !== null) throw new GameError("Your choice is already locked");
    return { pick: move.pick };
  },

  isFinished: (state) => state.pick !== null,

  score: () => 0,

  choice: (state) => state.pick,

  view: (state) => ({ options: OPTIONS, pick: state.pick, finished: state.pick !== null }),
};
