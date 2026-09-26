import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "@/lib/db/client";
import { getTopUpStats } from "@/lib/db/ledger";
import { ensureSeason, getPoolUnits, setSeasonStatus } from "@/lib/db/seasons";
import { PaymentError } from "@/lib/payments/verify";
import type { ServiceDeps } from "./deps";
import { requestEntryPayment } from "./entry";
import { registerDemoHuman } from "./identity";
import { confirmDemoTopUp, confirmTopUp, requestTopUp } from "./topup";
import { confirmEntryPayment, confirmDemoPayment } from "./entry";

const SPONSOR = "0x5555555555555555555555555555555555555555";
const OTHER = "0x6666666666666666666666666666666666666666";
const POOL = "0x9999999999999999999999999999999999999999";
const usdc = (n: number) => BigInt(n * 1_000_000);

async function makeDeps(demoMode = false): Promise<ServiceDeps> {
  let id = 0;
  const deps: ServiceDeps = {
    db: await createDb("file::memory:"),
    now: () => 1_000,
    newId: () => `ref${++id}`,
    seasonId: 1,
    entryFeeUnits: usdc(1),
    prizePoolAddress: POOL,
    gameSecret: "g".repeat(32),
    worldId: { rpId: "rp_test", environment: "production" },
    demoMode,
  };
  await ensureSeason(deps.db, 1, usdc(1), 0);
  return deps;
}

describe("prize pool top-ups", () => {
  let deps: ServiceDeps;
  beforeEach(async () => {
    deps = await makeDeps();
  });

  it("lets anyone grow the pool without taking a seat", async () => {
    const verify = vi.fn(async () => ({ transactionHash: "0x1" }));
    const request = await requestTopUp(deps, SPONSOR, usdc(25));
    expect(request).toEqual({ reference: "ref1", to: POOL, amountUnits: usdc(25).toString() });

    await confirmTopUp(deps, SPONSOR, { reference: request.reference, transactionId: "tx1" }, verify);
    expect(verify).toHaveBeenCalledWith("tx1", { reference: "ref1", to: POOL, amountUnits: usdc(25), from: SPONSOR });
    expect(await getPoolUnits(deps.db, 1)).toBe(usdc(25));

    const second = await requestTopUp(deps, SPONSOR, usdc(5));
    await confirmTopUp(deps, SPONSOR, { reference: second.reference, transactionId: "tx2" }, verify);
    const third = await requestTopUp(deps, OTHER, usdc(10));
    await confirmTopUp(deps, OTHER, { reference: third.reference, transactionId: "tx3" }, verify);

    const stats = await getTopUpStats(deps.db, 1);
    expect(stats).toEqual({
      totalUnits: usdc(40),
      sponsors: 2,
      top: [
        { address: SPONSOR, amountUnits: usdc(30) },
        { address: OTHER, amountUnits: usdc(10) },
      ],
    });
  });

  it("bounds the amount and refuses finished seasons", async () => {
    await expect(requestTopUp(deps, SPONSOR, usdc(0.5))).rejects.toMatchObject({ reason: "topup_amount" });
    await expect(requestTopUp(deps, SPONSOR, usdc(10_001))).rejects.toMatchObject({ reason: "topup_amount" });
    await setSeasonStatus(deps.db, 1, "finished");
    await expect(requestTopUp(deps, SPONSOR, usdc(5))).rejects.toMatchObject({ reason: "season_finished" });
  });

  it("cannot be confirmed by someone else, twice, or with a failed transfer", async () => {
    const ok = vi.fn(async () => ({}));
    const { reference } = await requestTopUp(deps, SPONSOR, usdc(5));
    await expect(confirmTopUp(deps, OTHER, { reference, transactionId: "t" }, ok)).rejects.toMatchObject({ code: "not_found" });
    const bad = vi.fn(async () => {
      throw new PaymentError("mismatch", "Payment amount too low");
    });
    await expect(confirmTopUp(deps, SPONSOR, { reference, transactionId: "t" }, bad)).rejects.toMatchObject({
      reason: "payment_invalid",
    });
    await confirmTopUp(deps, SPONSOR, { reference, transactionId: "t" }, ok);
    await expect(confirmTopUp(deps, SPONSOR, { reference, transactionId: "t" }, ok)).rejects.toMatchObject({ code: "conflict" });
  });

  it("a cheap top-up reference can never be used to buy a seat", async () => {
    const demo = await makeDeps(true);
    await registerDemoHuman(demo, SPONSOR);
    const topUp = await requestTopUp(demo, SPONSOR, usdc(1));
    await expect(confirmDemoPayment(demo, SPONSOR, topUp.reference)).rejects.toMatchObject({ code: "not_found" });
    await expect(
      confirmEntryPayment(demo, SPONSOR, { reference: topUp.reference, transactionId: "t" }, vi.fn(async () => ({}))),
    ).rejects.toMatchObject({ code: "not_found" });

    const entry = await requestEntryPayment(demo, SPONSOR);
    await expect(confirmDemoTopUp(demo, SPONSOR, entry.reference)).rejects.toMatchObject({ code: "not_found" });
  });

  it("simulates top-ups only in demo mode", async () => {
    const { reference } = await requestTopUp(deps, SPONSOR, usdc(3));
    await expect(confirmDemoTopUp(deps, SPONSOR, reference)).rejects.toMatchObject({ code: "forbidden" });
    const demo = await makeDeps(true);
    const demoRef = await requestTopUp(demo, SPONSOR, usdc(3));
    expect(await confirmDemoTopUp(demo, SPONSOR, demoRef.reference)).toEqual({ amountUnits: usdc(3).toString() });
    expect(await getPoolUnits(demo.db, 1)).toBe(usdc(3));
  });
});
