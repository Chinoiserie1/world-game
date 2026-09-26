import { describe, expect, it } from "vitest";
import { formatUsdc, splitPrize, usdcToUnits } from "./prize";

describe("splitPrize", () => {
  it("splits evenly and keeps dust", () => {
    expect(splitPrize(BigInt(10_000_001), 2)).toEqual({ perWinner: BigInt(5_000_000), remainder: BigInt(1) });
  });

  it("keeps everything when nobody won", () => {
    expect(splitPrize(BigInt(42), 0)).toEqual({ perWinner: BigInt(0), remainder: BigInt(42) });
  });

  it("rejects negative pools", () => {
    expect(() => splitPrize(BigInt(-1), 1)).toThrow(RangeError);
  });
});

describe("usdc helpers", () => {
  it("converts between decimal strings and base units", () => {
    expect(usdcToUnits("1")).toBe(BigInt(1_000_000));
    expect(usdcToUnits("0.25")).toBe(BigInt(250_000));
    expect(formatUsdc(BigInt(1_250_000))).toBe("1.25");
    expect(formatUsdc(BigInt(3_000_000))).toBe("3");
  });

  it("rejects malformed amounts", () => {
    expect(() => usdcToUnits("1.1234567")).toThrow(RangeError);
    expect(() => usdcToUnits("-1")).toThrow(RangeError);
  });
});
