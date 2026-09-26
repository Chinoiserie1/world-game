import { describe, expect, it } from "vitest";
import { decideSurvivors, type RoundResult } from "./elimination";

const alive = ["a", "b", "c", "d"];

describe("decideSurvivors", () => {
  it("eliminates players who did not finish a play", () => {
    const results: RoundResult[] = [{ address: "a", score: 1, choice: null }];
    const { survivors, eliminated } = decideSurvivors({ type: "threshold", minScore: 1 }, alive, results);
    expect(survivors).toEqual(["a"]);
    expect(eliminated).toEqual(["b", "c", "d"]);
  });

  it("threshold keeps scores >= minScore", () => {
    const results: RoundResult[] = [
      { address: "a", score: 1, choice: null },
      { address: "b", score: 0, choice: null },
      { address: "c", score: 2, choice: null },
    ];
    expect(decideSurvivors({ type: "threshold", minScore: 1 }, alive, results).survivors).toEqual(["a", "c"]);
  });

  it("top-percent keeps the best half and everyone tied at the cut", () => {
    const results: RoundResult[] = [
      { address: "a", score: 10, choice: null },
      { address: "b", score: 5, choice: null },
      { address: "c", score: 5, choice: null },
      { address: "d", score: 1, choice: null },
    ];
    const { survivors } = decideSurvivors({ type: "top-percent", percent: 50 }, alive, results);
    expect(survivors).toEqual(["a", "b", "c"]);
  });

  it("top-percent always keeps at least one player", () => {
    const { survivors } = decideSurvivors({ type: "top-percent", percent: 10 }, ["a"], [
      { address: "a", score: 0, choice: null },
    ]);
    expect(survivors).toEqual(["a"]);
  });

  it("minority keeps the smaller group", () => {
    const results: RoundResult[] = [
      { address: "a", score: 0, choice: "red" },
      { address: "b", score: 0, choice: "blue" },
      { address: "c", score: 0, choice: "blue" },
      { address: "d", score: 0, choice: "blue" },
    ];
    expect(decideSurvivors({ type: "minority" }, alive, results).survivors).toEqual(["a"]);
  });

  it("minority tie lets every voter survive", () => {
    const results: RoundResult[] = [
      { address: "a", score: 0, choice: "red" },
      { address: "b", score: 0, choice: "blue" },
    ];
    expect(decideSurvivors({ type: "minority" }, alive, results).survivors).toEqual(["a", "b"]);
  });

  it("ignores results from players that were not alive", () => {
    const results: RoundResult[] = [{ address: "zombie", score: 99, choice: null }];
    expect(decideSurvivors({ type: "threshold", minScore: 0 }, ["a"], results).survivors).toEqual([]);
  });
});
