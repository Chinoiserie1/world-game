import { z } from "zod";
import { parseWith } from "./parse";
import { seededShuffle } from "./rng";
import { GameError, type GameEngine } from "./types";

export const SIZE = 8;
export const MINES = 10;
export const TIME_LIMIT_MS = 3 * 60 * 1000;
const CLEAR_BONUS = 10;
const CELLS = SIZE * SIZE;

export interface MinesweeperState {
  readonly startedAt: number;
  /** Mine positions, fixed on the first reveal from (seed, firstIndex). */
  readonly mines: readonly number[] | null;
  readonly revealed: readonly number[];
  readonly exploded: number | null;
}

export interface MinesweeperMove {
  readonly index: number;
}

/** "hidden" | "mine" | adjacent-mine count (0-8). */
export type CellView = "hidden" | "mine" | number;

export interface MinesweeperView {
  readonly size: number;
  readonly mines: number;
  readonly cells: readonly CellView[];
  readonly exploded: number | null;
  readonly won: boolean;
  readonly finished: boolean;
  readonly deadline: number;
}

const moveSchema = z.object({ index: z.number().int().min(0).max(CELLS - 1) });

export function neighbors(index: number): number[] {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = row + dr;
      const c = col + dc;
      if ((dr !== 0 || dc !== 0) && r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        result.push(r * SIZE + c);
      }
    }
  }
  return result;
}

/**
 * Mines are a deterministic function of (committed seed, first click), so the
 * first click is always safe and the board is still verifiable after reveal.
 */
export function placeMines(seed: string, firstIndex: number): number[] {
  const safeZone = new Set([firstIndex, ...neighbors(firstIndex)]);
  const candidates = Array.from({ length: CELLS }, (_, i) => i).filter((i) => !safeZone.has(i));
  return seededShuffle(seed, "mines", candidates)
    .slice(0, MINES)
    .sort((a, b) => a - b);
}

function adjacentMines(index: number, mines: ReadonlySet<number>): number {
  return neighbors(index).filter((n) => mines.has(n)).length;
}

function floodReveal(start: number, mines: ReadonlySet<number>, alreadyOpen: readonly number[]): number[] {
  const open = new Set(alreadyOpen);
  const stack = [start];
  while (stack.length > 0) {
    const cell = stack.pop()!;
    if (open.has(cell) || mines.has(cell)) continue;
    open.add(cell);
    if (adjacentMines(cell, mines) === 0) stack.push(...neighbors(cell));
  }
  return [...open].sort((a, b) => a - b);
}

function isWon(state: MinesweeperState): boolean {
  return state.exploded === null && state.revealed.length === CELLS - MINES;
}

function isTimeUp(state: MinesweeperState, now: number): boolean {
  return now - state.startedAt > TIME_LIMIT_MS;
}

function finished(state: MinesweeperState, now: number): boolean {
  return state.exploded !== null || isWon(state) || isTimeUp(state, now);
}

export const minesweeper: GameEngine<MinesweeperState, MinesweeperMove, MinesweeperView> = {
  id: "minesweeper",
  title: "Minesweeper",
  tagline: "8×8, 10 mines, 3 minutes. One wrong step.",
  rules: [
    "Reveal as many safe cells as you can in 3 minutes.",
    "Your first tap is always safe; hitting a mine ends your game.",
    "Score = cells revealed (+10 for clearing the board).",
    "The top half of players survives.",
  ],
  survival: { type: "top-percent", percent: 50 },

  init: (ctx) => ({ startedAt: ctx.now, mines: null, revealed: [], exploded: null }),

  parseMove: (raw) => parseWith(moveSchema, raw),

  applyMove(state, move, ctx) {
    if (finished(state, ctx.now)) throw new GameError("Game already finished");
    if (state.revealed.includes(move.index)) return state;

    const mines = state.mines ?? placeMines(ctx.seed, move.index);
    const mineSet = new Set(mines);
    if (mineSet.has(move.index)) {
      return { ...state, mines, exploded: move.index };
    }
    return { ...state, mines, revealed: floodReveal(move.index, mineSet, state.revealed) };
  },

  isFinished: finished,

  score: (state) => state.revealed.length + (isWon(state) ? CLEAR_BONUS : 0),

  view(state, now) {
    const done = finished(state, now);
    const mineSet = new Set(state.mines ?? []);
    const open = new Set(state.revealed);
    const cells = Array.from({ length: CELLS }, (_, i): CellView => {
      if (open.has(i)) return adjacentMines(i, mineSet);
      if (done && mineSet.has(i)) return "mine";
      return "hidden";
    });
    return {
      size: SIZE,
      mines: MINES,
      cells,
      exploded: state.exploded,
      won: isWon(state),
      finished: done,
      deadline: state.startedAt + TIME_LIMIT_MS,
    };
  },
};
