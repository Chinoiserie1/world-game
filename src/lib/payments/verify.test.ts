import { describe, expect, it, vi } from "vitest";
import { TRANSACTION_URL, verifyEntryPayment } from "./verify";

const pool = "0x00000000000000000000000000000000000000Aa";
const player = "0x1111111111111111111111111111111111111111";
const expected = { reference: "ref1", to: pool, amountUnits: BigInt(1_000_000), from: player };

function portalReturning(body: Record<string, unknown>, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const good = {
  reference: "ref1",
  transaction_hash: "0xhash",
  transaction_status: "mined",
  from: player,
  to: pool.toLowerCase(),
  token: "USDCE",
  token_amount: "1000000",
};

describe("verifyEntryPayment", () => {
  it("accepts a mined USDC payment to the prize pool", async () => {
    const fetchImpl = portalReturning(good);
    const result = await verifyEntryPayment("tx_1", expected, { appId: "app_x", apiKey: "k", fetchImpl });
    expect(result.transactionHash).toBe("0xhash");
    expect(fetchImpl).toHaveBeenCalledWith(
      `${TRANSACTION_URL}/tx_1?app_id=app_x&type=payment`,
      expect.objectContaining({ headers: { Authorization: "Bearer k" } }),
    );
  });

  it.each([
    [{ reference: "other" }, "mismatch"],
    [{ to: player }, "mismatch"],
    [{ from: pool }, "mismatch"],
    [{ token: "WLD" }, "mismatch"],
    [{ token_amount: "999999" }, "mismatch"],
    [{ transaction_status: "pending" }, "pending"],
    [{ transaction_status: "failed" }, "failed"],
  ])("rejects %o with %s", async (override, code) => {
    await expect(
      verifyEntryPayment("tx_1", expected, { appId: "a", apiKey: "k", fetchImpl: portalReturning({ ...good, ...override }) }),
    ).rejects.toMatchObject({ code });
  });

  it("reports portal outages", async () => {
    await expect(
      verifyEntryPayment("tx_1", expected, { appId: "a", apiKey: "k", fetchImpl: portalReturning({}, 500) }),
    ).rejects.toMatchObject({ code: "unavailable" });
    await expect(
      verifyEntryPayment("tx_1", expected, { appId: "a", apiKey: "k", fetchImpl: portalReturning({ bad: 1 }) }),
    ).rejects.toMatchObject({ code: "unavailable" });
    const throwing = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(verifyEntryPayment("tx_1", expected, { appId: "a", apiKey: "k", fetchImpl: throwing })).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
