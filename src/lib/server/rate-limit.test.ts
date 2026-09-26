import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window then resets", () => {
    const limiter = createRateLimiter(2, 1_000);
    expect(limiter.check("k", 0)).toBe(true);
    expect(limiter.check("k", 10)).toBe(true);
    expect(limiter.check("k", 20)).toBe(false);
    expect(limiter.check("other", 20)).toBe(true);
    expect(limiter.check("k", 1_000)).toBe(true);
  });
});
