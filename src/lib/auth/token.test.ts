import { describe, expect, it } from "vitest";
import { createToken, normalizeAddress, readToken } from "./token";

const secret = "x".repeat(32);
const address = "0x1111111111111111111111111111111111111111";

describe("session token", () => {
  it("round-trips a valid token", () => {
    const token = createToken({ address, exp: 2_000 }, secret);
    expect(readToken(token, secret, 1_000)).toEqual({ address, exp: 2_000 });
  });

  it("rejects expired, tampered, foreign or malformed tokens", () => {
    const token = createToken({ address, exp: 2_000 }, secret);
    expect(readToken(token, secret, 2_000)).toBeNull();
    expect(readToken(token, "y".repeat(32), 1_000)).toBeNull();
    const [data, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ address: "0xevil", exp: 9e12 })).toString("base64url");
    expect(readToken(`${forged}.${sig}`, secret, 1_000)).toBeNull();
    expect(readToken(`${data}`, secret, 1_000)).toBeNull();
    expect(readToken(undefined, secret, 1_000)).toBeNull();
    const badJson = Buffer.from("nope").toString("base64url");
    expect(readToken(createToken({ address, exp: 1 }, secret).replace(/^[^.]+/, badJson), secret, 0)).toBeNull();
  });
});

describe("normalizeAddress", () => {
  it("lowercases valid addresses and rejects invalid ones", () => {
    expect(normalizeAddress("0xABCDEFabcdef0000000000000000000000000000")).toBe("0xabcdefabcdef0000000000000000000000000000");
    expect(() => normalizeAddress("0x123")).toThrow();
  });
});
