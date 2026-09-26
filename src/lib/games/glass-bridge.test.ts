import { describe, expect, it } from "vitest";
import { GameError } from "./types";
import { STEPS, glassBridge, safeSide } from "./glass-bridge";

const ctx = { seed: "seed-bridge", now: 0 };

describe("glass bridge engine", () => {
  it("advances on the safe panel and stops on the wrong one", () => {
    const start = glassBridge.init(ctx);
    const safe = safeSide(ctx.seed, 0);
    const moved = glassBridge.applyMove(start, { side: safe }, ctx);
    expect(glassBridge.score(moved)).toBe(1);
    expect(glassBridge.isFinished(moved, 0)).toBe(false);

    const wrong = safeSide(ctx.seed, 1) === "left" ? "right" : "left";
    const fell = glassBridge.applyMove(moved, { side: wrong }, ctx);
    expect(fell.fell).toBe(true);
    expect(glassBridge.score(fell)).toBe(1);
    expect(glassBridge.isFinished(fell, 0)).toBe(true);
    expect(() => glassBridge.applyMove(fell, { side: "left" }, ctx)).toThrow(GameError);
  });

  it("finishes after crossing every step and reveals the path only at the end", () => {
    let state = glassBridge.init(ctx);
    expect(glassBridge.view(state, 0).path).toBeNull();
    for (let i = 0; i < STEPS; i += 1) {
      state = glassBridge.applyMove(state, { side: safeSide(ctx.seed, i) }, ctx);
    }
    expect(glassBridge.isFinished(state, 0)).toBe(true);
    expect(glassBridge.score(state)).toBe(STEPS);
    expect(glassBridge.view(state, 0).path).toHaveLength(STEPS);
  });

  it("does not mutate state and validates moves", () => {
    const start = glassBridge.init(ctx);
    glassBridge.applyMove(start, { side: "left" }, ctx);
    expect(start.choices).toEqual([]);
    expect(() => glassBridge.parseMove({ side: "up" })).toThrow(GameError);
  });
});
