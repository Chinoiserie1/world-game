import { describe, expect, it } from "vitest";
import { GameError } from "./types";
import { houseThrow, outcomeOf, rps, type RpsState } from "./rps";

const ctx = { seed: "seed-rps", now: 0 };

function playUntilDone(state: RpsState, pick: "rock" | "paper" | "scissors"): RpsState {
  let current = state;
  while (!rps.isFinished(current, 0)) {
    current = rps.applyMove(current, { throw: pick }, ctx);
  }
  return current;
}

describe("outcomeOf", () => {
  it("applies classic rules", () => {
    expect(outcomeOf("rock", "scissors")).toBe("win");
    expect(outcomeOf("scissors", "paper")).toBe("win");
    expect(outcomeOf("paper", "rock")).toBe("win");
    expect(outcomeOf("rock", "paper")).toBe("loss");
    expect(outcomeOf("rock", "rock")).toBe("draw");
  });
});

describe("rps engine", () => {
  it("starts empty and unfinished", () => {
    const state = rps.init(ctx);
    expect(state.throws).toEqual([]);
    expect(rps.isFinished(state, 0)).toBe(false);
    expect(rps.score(state)).toBe(0);
  });

  it("uses the committed seed for house throws (deterministic)", () => {
    expect(houseThrow("abc", 0)).toBe(houseThrow("abc", 0));
    const state = rps.applyMove(rps.init(ctx), { throw: "rock" }, ctx);
    expect(state.throws[0].house).toBe(houseThrow(ctx.seed, 0));
  });

  it("does not mutate the previous state", () => {
    const initial = rps.init(ctx);
    rps.applyMove(initial, { throw: "rock" }, ctx);
    expect(initial.throws).toHaveLength(0);
  });

  it("finishes when someone reaches 3 wins and scores 1 only for a player victory", () => {
    const done = playUntilDone(rps.init(ctx), "rock");
    const view = rps.view(done, 0);
    expect(view.finished).toBe(true);
    expect(Math.max(view.playerWins, view.houseWins)).toBe(3);
    expect(rps.score(done)).toBe(view.playerWins === 3 ? 1 : 0);
  });

  it("rejects moves after the match ended", () => {
    const done = playUntilDone(rps.init(ctx), "paper");
    expect(() => rps.applyMove(done, { throw: "rock" }, ctx)).toThrow(GameError);
  });

  it("caps the number of throws so draws cannot loop forever", () => {
    const allDraws: RpsState = {
      throws: Array.from({ length: 15 }, () => ({ player: "rock", house: "rock" }) as const),
    };
    expect(rps.isFinished(allDraws, 0)).toBe(true);
    expect(rps.score(allDraws)).toBe(0);
  });

  it("validates raw moves", () => {
    expect(rps.parseMove({ throw: "paper" })).toEqual({ throw: "paper" });
    expect(() => rps.parseMove({ throw: "lizard" })).toThrow(GameError);
    expect(() => rps.parseMove(null)).toThrow(GameError);
  });
});
