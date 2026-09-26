import { describe, expect, it } from "vitest";
import { GameError } from "./types";
import { minority } from "./minority";
import { gameCatalog, getEngine, isGameId, SEASON_GAME_ORDER } from "./registry";

const ctx = { seed: "s", now: 0 };

describe("minority engine", () => {
  it("locks a single choice", () => {
    const picked = minority.applyMove(minority.init(ctx), { pick: "red" }, ctx);
    expect(minority.choice?.(picked)).toBe("red");
    expect(minority.isFinished(picked, 0)).toBe(true);
    expect(minority.view(picked, 0).pick).toBe("red");
    expect(() => minority.applyMove(picked, { pick: "blue" }, ctx)).toThrow(GameError);
    expect(() => minority.parseMove({ pick: "green" })).toThrow(GameError);
  });
});

describe("registry", () => {
  it("exposes 4 weekly games in order", () => {
    expect(SEASON_GAME_ORDER).toEqual(["rps", "minesweeper", "glass-bridge", "minority"]);
    expect(gameCatalog().map((g) => g.week)).toEqual([1, 2, 3, 4]);
    expect(getEngine("minesweeper").id).toBe("minesweeper");
    expect(isGameId("rps")).toBe(true);
    expect(isGameId("poker")).toBe(false);
  });
});
