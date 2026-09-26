export const GAME_IDS = ["rps", "minesweeper", "glass-bridge", "minority"] as const;
export type GameId = (typeof GAME_IDS)[number];

/**
 * How a round decides who survives once it closes.
 * - threshold: survive when score >= minScore
 * - top-percent: survive when ranked in the best `percent` (ties at the cut survive)
 * - minority: survive when your choice was picked by the smaller group (tie → everyone survives)
 */
export type SurvivalRule =
  | { readonly type: "threshold"; readonly minScore: number }
  | { readonly type: "top-percent"; readonly percent: number }
  | { readonly type: "minority" };

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export interface GameContext {
  readonly seed: string;
  readonly now: number;
}

/**
 * A game is a pure state machine. Every transition returns a new state; the
 * server keeps the full state (including secrets) and only sends `view()` out.
 */
export interface GameEngine<State, Move, View> {
  readonly id: GameId;
  readonly title: string;
  readonly tagline: string;
  readonly rules: readonly string[];
  readonly survival: SurvivalRule;
  init(ctx: GameContext): State;
  parseMove(raw: unknown): Move;
  applyMove(state: State, move: Move, ctx: GameContext): State;
  isFinished(state: State, now: number): boolean;
  /** Final (or current) score used by the survival rule. */
  score(state: State): number;
  /** Optional categorical outcome used by rules such as `minority`. */
  choice?(state: State): string | null;
  view(state: State, now: number): View;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameEngine = GameEngine<any, any, any>;
