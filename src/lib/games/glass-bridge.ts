import { z } from "zod";
import { parseWith } from "./parse";
import { randomInt } from "./rng";
import { GameError, type GameEngine } from "./types";

export const STEPS = 12;
export const SIDES = ["left", "right"] as const;
export type Side = (typeof SIDES)[number];

export interface GlassBridgeState {
  readonly choices: readonly Side[];
  readonly fell: boolean;
}

export interface GlassBridgeMove {
  readonly side: Side;
}

export interface GlassBridgeView {
  readonly steps: number;
  readonly position: number;
  readonly choices: readonly Side[];
  readonly fell: boolean;
  readonly finished: boolean;
  /** Tempered-glass path, only revealed when the play is over. */
  readonly path: readonly Side[] | null;
}

const moveSchema = z.object({ side: z.enum(SIDES) });

export function safeSide(seed: string, step: number): Side {
  return SIDES[randomInt(seed, `bridge:${step}`, SIDES.length)];
}

function position(state: GlassBridgeState): number {
  return state.fell ? state.choices.length - 1 : state.choices.length;
}

function finished(state: GlassBridgeState): boolean {
  return state.fell || state.choices.length >= STEPS;
}

/** The full tempered-glass path is stored once the play ends so view() can reveal it. */
interface InternalState extends GlassBridgeState {
  readonly path?: readonly Side[];
}

const glassBridgeEngine: GameEngine<InternalState, GlassBridgeMove, GlassBridgeView> = {
  id: "glass-bridge",
  title: "Glass Bridge",
  tagline: "12 pairs of panels. Only one holds on each row.",
  rules: [
    "On each row, pick the left or the right panel.",
    "The tempered glass is drawn and committed (hashed) before your first step.",
    "Score = rows crossed. The top half survives.",
  ],
  survival: { type: "top-percent", percent: 50 },

  init: () => ({ choices: [], fell: false }),

  parseMove: (raw) => parseWith(moveSchema, raw),

  applyMove(state, move, ctx) {
    if (finished(state)) throw new GameError("You already left the bridge");
    const step = state.choices.length;
    const fell = safeSide(ctx.seed, step) !== move.side;
    const next: InternalState = { choices: [...state.choices, move.side], fell };
    if (!finished(next)) return next;
    const path = Array.from({ length: STEPS }, (_, i) => safeSide(ctx.seed, i));
    return { ...next, path };
  },

  isFinished: (state) => finished(state),

  score: (state) => position(state),

  view(state) {
    return {
      steps: STEPS,
      position: position(state),
      choices: state.choices,
      fell: state.fell,
      finished: finished(state),
      path: finished(state) ? (state.path ?? null) : null,
    };
  },
};

export const glassBridge = glassBridgeEngine;
