import { describe, expect, it } from "vitest";
import { GameError } from "./types";
import {
  MINES,
  SIZE,
  TIME_LIMIT_MS,
  minesweeper,
  neighbors,
  placeMines,
  type MinesweeperState,
} from "./minesweeper";

const ctx = (now = 1_000) => ({ seed: "seed-mines", now });

function reveal(state: MinesweeperState, index: number, now = 1_000): MinesweeperState {
  return minesweeper.applyMove(state, { index }, ctx(now));
}

describe("neighbors", () => {
  it("handles corners and centre", () => {
    expect(neighbors(0).sort((a, b) => a - b)).toEqual([1, SIZE, SIZE + 1]);
    expect(neighbors(SIZE + 1)).toHaveLength(8);
  });
});

describe("placeMines", () => {
  it("is deterministic for a seed and first click", () => {
    expect(placeMines("s", 10)).toEqual(placeMines("s", 10));
  });

  it("places the right amount and keeps the first click area safe", () => {
    for (const first of [0, 27, SIZE * SIZE - 1]) {
      const mines = placeMines("s", first);
      expect(new Set(mines).size).toBe(MINES);
      expect(mines).not.toContain(first);
      for (const n of neighbors(first)) expect(mines).not.toContain(n);
    }
  });
});

describe("minesweeper engine", () => {
  it("first reveal is always safe and floods open an area", () => {
    const state = reveal(minesweeper.init(ctx()), 27);
    expect(state.exploded).toBeNull();
    expect(state.revealed.length).toBeGreaterThan(1);
    expect(minesweeper.score(state)).toBe(state.revealed.length);
  });

  it("does not mutate the previous state", () => {
    const initial = minesweeper.init(ctx());
    reveal(initial, 0);
    expect(initial.revealed).toEqual([]);
    expect(initial.mines).toBeNull();
  });

  it("ends the game when a mine is hit and hides mines until then", () => {
    const opened = reveal(minesweeper.init(ctx()), 27);
    const hiddenView = minesweeper.view(opened, 1_000);
    expect(hiddenView.cells.some((c) => c === "mine")).toBe(false);

    const mine = opened.mines![0];
    const boom = reveal(opened, mine);
    expect(boom.exploded).toBe(mine);
    expect(minesweeper.isFinished(boom, 1_000)).toBe(true);
    expect(minesweeper.view(boom, 1_000).cells.filter((c) => c === "mine")).toHaveLength(MINES);
    expect(() => reveal(boom, 0)).toThrow(GameError);
  });

  it("awards a bonus when every safe cell is cleared", () => {
    let state = reveal(minesweeper.init(ctx()), 27);
    const mines = new Set(state.mines);
    for (let i = 0; i < SIZE * SIZE; i += 1) {
      if (!mines.has(i) && !state.revealed.includes(i)) state = reveal(state, i);
    }
    expect(minesweeper.isFinished(state, 1_000)).toBe(true);
    expect(minesweeper.view(state, 1_000).won).toBe(true);
    expect(minesweeper.score(state)).toBe(SIZE * SIZE - MINES + 10);
  });

  it("stops accepting moves after the time limit", () => {
    const state = reveal(minesweeper.init(ctx(0)), 27, 0);
    expect(minesweeper.isFinished(state, TIME_LIMIT_MS + 1)).toBe(true);
    expect(() => reveal(state, 0, TIME_LIMIT_MS + 1)).toThrow(GameError);
  });

  it("ignores re-revealing an already open cell", () => {
    const state = reveal(minesweeper.init(ctx()), 27);
    expect(reveal(state, 27)).toBe(state);
  });

  it("validates cell indexes", () => {
    expect(() => minesweeper.parseMove({ index: -1 })).toThrow(GameError);
    expect(() => minesweeper.parseMove({ index: SIZE * SIZE })).toThrow(GameError);
    expect(minesweeper.parseMove({ index: 5 })).toEqual({ index: 5 });
  });
});
