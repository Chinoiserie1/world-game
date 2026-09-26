import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "@/lib/db/client";
import { getPlayer } from "@/lib/db/players";
import { ensureSeason, getPoolUnits } from "@/lib/db/seasons";
import { houseThrow, THROWS, type Throw } from "@/lib/games/rps";
import { PaymentError } from "@/lib/payments/verify";
import { closeOpenRound, openNextRound } from "./admin";
import { claimPrize } from "./claims";
import { ServiceError, type ServiceDeps } from "./deps";
import { confirmDemoPayment, confirmEntryPayment, requestEntryPayment } from "./entry";
import { lockIdentity, registerDemoHuman, registerHuman } from "./identity";
import { getOverview } from "./overview";
import { passCheckpoint, passDemoCheckpoint, playMove, startPlay } from "./rounds";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const POOL = "0x9999999999999999999999999999999999999999";
const FEE = BigInt(1_000_000);

let counter = 0;
const nextHex = () => `0x${(++counter).toString(16).padStart(4, "0")}`;

function entryProof(address: string, nullifier: string, identifier = "proof_of_human", extra: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce: nextHex(),
    action: "world-game-s1-entry",
    environment: "production",
    responses: [{ identifier, signal_hash: hashSignal(address), proof: ["0x1"], nullifier, issuer_schema_id: 1, expires_at_min: 1, ...extra }],
  };
}

function sessionProof(sessionId: string, identifier = "proof_of_human", nullifier = nextHex()) {
  return {
    protocol_version: "4.0",
    nonce: nextHex(),
    session_id: sessionId,
    environment: "production",
    responses: [{ identifier, proof: ["0x1"], session_nullifier: [nullifier, "0x1"], issuer_schema_id: 1, expires_at_min: 1 }],
  };
}

const portalOk = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));

async function makeDeps(overrides: Partial<ServiceDeps> = {}): Promise<ServiceDeps> {
  let clock = 1_000_000;
  let id = 0;
  const deps: ServiceDeps = {
    db: await createDb("file::memory:"),
    now: () => (clock += 1_000),
    newId: () => `id${++id}`,
    seasonId: 1,
    entryFeeUnits: FEE,
    prizePoolAddress: POOL,
    gameSecret: "g".repeat(32),
    worldId: { rpId: "rp_test", environment: "production", fetchImpl: portalOk },
    demoMode: false,
    ...overrides,
  };
  await ensureSeason(deps.db, deps.seasonId, FEE, deps.now());
  return deps;
}

const paymentOk = vi.fn(async () => ({ transactionHash: "0xhash" }));

async function enterRealPlayer(deps: ServiceDeps, address: string, nullifier: string, session: string) {
  await registerHuman(deps, address, entryProof(address, nullifier));
  await lockIdentity(deps, address, sessionProof(session));
  const payment = await requestEntryPayment(deps, address);
  return confirmEntryPayment(deps, address, { reference: payment.reference, transactionId: `tx_${address}` }, paymentOk);
}

/** Plays RPS optimally using the revealed-later seed (test-only oracle). */
async function winRps(deps: ServiceDeps, address: string, seed: string) {
  const beat: Record<Throw, Throw> = { rock: "paper", paper: "scissors", scissors: "rock" };
  let view = await startPlay(deps, address);
  for (let i = 0; !view.finished; i += 1) view = await playMove(deps, address, { throw: beat[houseThrow(seed, i)] });
  return view;
}

async function loseRps(deps: ServiceDeps, address: string, seed: string) {
  const loseTo: Record<Throw, Throw> = { rock: "scissors", paper: "rock", scissors: "paper" };
  let view = await startPlay(deps, address);
  for (let i = 0; !view.finished; i += 1) view = await playMove(deps, address, { throw: loseTo[houseThrow(seed, i)] });
  return view;
}

describe("season flow", () => {
  let deps: ServiceDeps;
  beforeEach(async () => {
    counter = 0;
    deps = await makeDeps();
  });

  it("runs entry → weekly checkpoint → elimination → claim", async () => {
    const alice = await enterRealPlayer(deps, ALICE, "0x01", "session_alice");
    await enterRealPlayer(deps, BOB, "0x02", "session_bob");
    expect(alice.status).toBe("alive");
    expect(await getPoolUnits(deps.db, 1)).toBe(FEE * BigInt(2));

    await openNextRound(deps);
    await passCheckpoint(deps, ALICE, sessionProof("session_alice"));
    await passCheckpoint(deps, BOB, sessionProof("session_bob"));

    const { deriveSeed } = await import("@/lib/games/rng");
    const aliceStart = await startPlay(deps, ALICE);
    expect(aliceStart.seed).toBeNull();
    const aliceEnd = await winRps(deps, ALICE, deriveSeed(deps.gameSecret, aliceStart.playId));
    expect(aliceEnd.score).toBe(1);
    expect(aliceEnd.seed).toBe(deriveSeed(deps.gameSecret, aliceStart.playId));

    const bobStart = await startPlay(deps, BOB);
    await loseRps(deps, BOB, deriveSeed(deps.gameSecret, bobStart.playId));

    const week1 = await closeOpenRound(deps);
    expect(week1.survivors).toEqual([ALICE]);
    expect((await getPlayer(deps.db, 1, BOB))?.status).toBe("eliminated");

    // Bob is out: no more checkpoints for him.
    await openNextRound(deps);
    await expect(passCheckpoint(deps, BOB, sessionProof("session_bob"))).rejects.toMatchObject({ reason: "eliminated" });

    // Alice survives the remaining weeks (a lone player always survives).
    for (let week = 2; week <= 4; week += 1) {
      if (week > 2) await openNextRound(deps);
      await passCheckpoint(deps, ALICE, sessionProof("session_alice"));
      const view = await startPlay(deps, ALICE);
      if (view.gameId === "minority") await playMove(deps, ALICE, { pick: "red" });
      if (view.gameId === "glass-bridge") await playMove(deps, ALICE, { side: "left" });
      if (view.gameId === "minesweeper") await playMove(deps, ALICE, { index: 27 });
      const closed = await closeOpenRound(deps);
      expect(closed.survivors).toEqual([ALICE]);
      expect(closed.seasonFinished).toBe(week === 4);
    }

    const overview = await getOverview(deps, ALICE);
    expect(overview.season.status).toBe("finished");
    expect(overview.me?.status).toBe("winner");
    expect(overview.me?.prizeUnits).toBe((FEE * BigInt(2)).toString());

    const payout = vi.fn(async () => "0xpayout");
    const claim = await claimPrize(deps, ALICE, sessionProof("session_alice"), payout);
    expect(claim).toMatchObject({ status: "paid", txHash: "0xpayout", amountUnits: FEE * BigInt(2) });
    expect(payout).toHaveBeenCalledWith(ALICE, FEE * BigInt(2), `s1:${ALICE}`);
    await expect(claimPrize(deps, ALICE, sessionProof("session_alice"), payout)).rejects.toMatchObject({ code: "conflict" });
    await expect(claimPrize(deps, BOB, sessionProof("session_bob"), payout)).rejects.toMatchObject({ reason: "not_winner" });
  });

  it("blocks a second wallet using the same World ID (Sybil)", async () => {
    await registerHuman(deps, ALICE, entryProof(ALICE, "0x0001"));
    await expect(registerHuman(deps, BOB, entryProof(BOB, "0x01"))).rejects.toMatchObject({
      reason: "nullifier_replayed",
    });
    // The failed attempt must not leave a half-registered player behind.
    expect(await getPlayer(deps.db, 1, BOB)).toBeNull();
  });

  it("blocks re-registering the same wallet and proofs bound to another wallet", async () => {
    await registerHuman(deps, ALICE, entryProof(ALICE, "0x01"));
    await expect(registerHuman(deps, ALICE, entryProof(ALICE, "0x02"))).rejects.toMatchObject({ reason: "already_registered" });
    await expect(registerHuman(deps, BOB, entryProof(ALICE, "0x03"))).rejects.toMatchObject({ reason: "signal_mismatch" });
  });

  it("stops someone else's World ID at the weekly checkpoint (account sold / bot)", async () => {
    await enterRealPlayer(deps, ALICE, "0x01", "session_alice");
    await openNextRound(deps);
    await expect(passCheckpoint(deps, ALICE, sessionProof("session_mallory"))).rejects.toMatchObject({
      reason: "session_mismatch",
    });
    await expect(startPlay(deps, ALICE)).rejects.toMatchObject({ reason: "checkpoint_required" });
  });

  it("rejects replayed session proofs", async () => {
    await enterRealPlayer(deps, ALICE, "0x01", "session_alice");
    await openNextRound(deps);
    const proof = sessionProof("session_alice", "proof_of_human", "0xdead");
    await passCheckpoint(deps, ALICE, proof);
    await expect(passCheckpoint(deps, ALICE, { ...proof, nonce: "0xnew" })).rejects.toMatchObject({
      reason: "session_replayed",
    });
  });

  it("only lets Orb-verified World IDs in (no Selfie Check)", async () => {
    const selfie = entryProof(ALICE, "0x01", "selfie", { sybil_score: 2, issuer_schema_id: 11 });
    await expect(registerHuman(deps, ALICE, selfie)).rejects.toMatchObject({ reason: "credential_not_accepted" });
    expect(await getPlayer(deps.db, 1, ALICE)).toBeNull();

    await registerHuman(deps, ALICE, entryProof(ALICE, "0x02"));
    await expect(lockIdentity(deps, ALICE, sessionProof("session_alice", "selfie"))).rejects.toMatchObject({
      reason: "credential_not_accepted",
    });
    await lockIdentity(deps, ALICE, sessionProof("session_alice"));
  });

  it("enforces the entry order: verify → lock session → pay", async () => {
    await expect(requestEntryPayment(deps, ALICE)).rejects.toMatchObject({ reason: "not_registered" });
    await registerHuman(deps, ALICE, entryProof(ALICE, "0x01"));
    await expect(requestEntryPayment(deps, ALICE)).rejects.toMatchObject({ reason: "session_required" });
    await lockIdentity(deps, ALICE, sessionProof("session_alice"));
    await expect(lockIdentity(deps, ALICE, sessionProof("session_other"))).rejects.toMatchObject({
      reason: "session_already_bound",
    });
  });

  it("maps payment verification failures", async () => {
    await registerHuman(deps, ALICE, entryProof(ALICE, "0x01"));
    await lockIdentity(deps, ALICE, sessionProof("session_alice"));
    const { reference } = await requestEntryPayment(deps, ALICE);
    const failing = (code: "pending" | "mismatch" | "unavailable") => async () => {
      throw new PaymentError(code, code);
    };
    await expect(confirmEntryPayment(deps, ALICE, { reference, transactionId: "t" }, failing("pending"))).rejects.toMatchObject({
      status: 202,
    });
    await expect(confirmEntryPayment(deps, ALICE, { reference, transactionId: "t" }, failing("mismatch"))).rejects.toMatchObject({
      reason: "payment_invalid",
    });
    await expect(confirmEntryPayment(deps, ALICE, { reference, transactionId: "t" }, failing("unavailable"))).rejects.toMatchObject({
      status: 503,
    });
    await expect(confirmEntryPayment(deps, BOB, { reference, transactionId: "t" }, paymentOk)).rejects.toBeInstanceOf(ServiceError);
    await confirmEntryPayment(deps, ALICE, { reference, transactionId: "t" }, paymentOk);
    await expect(confirmEntryPayment(deps, ALICE, { reference, transactionId: "t" }, paymentOk)).rejects.toMatchObject({
      reason: "already_entered",
    });
  });

  it("closes registrations once week 1 starts and refuses rounds without players", async () => {
    await expect(openNextRound(deps)).rejects.toMatchObject({ code: "conflict" });
    await enterRealPlayer(deps, ALICE, "0x01", "session_alice");
    await openNextRound(deps);
    await expect(openNextRound(deps)).rejects.toMatchObject({ code: "conflict" });
    await expect(registerHuman(deps, BOB, entryProof(BOB, "0x02"))).rejects.toMatchObject({ reason: "registration_closed" });
  });

  it("eliminates players who skip the week and rejects moves outside the rules", async () => {
    await enterRealPlayer(deps, ALICE, "0x01", "session_alice");
    await enterRealPlayer(deps, BOB, "0x02", "session_bob");
    await openNextRound(deps);
    await passCheckpoint(deps, ALICE, sessionProof("session_alice"));
    await expect(playMove(deps, ALICE, { throw: "rock" })).rejects.toMatchObject({ reason: "no_play" });
    await startPlay(deps, ALICE);
    await expect(playMove(deps, ALICE, { throw: "lizard" })).rejects.toMatchObject({ reason: "illegal_move" });
    for (const t of THROWS) await playMove(deps, ALICE, { throw: t }).catch(() => undefined);
    const result = await closeOpenRound(deps);
    expect(result.eliminated).toContain(BOB);
  });

  it("finishes the season with no winner when everybody is eliminated", async () => {
    await enterRealPlayer(deps, ALICE, "0x01", "session_alice");
    await openNextRound(deps);
    const result = await closeOpenRound(deps);
    expect(result).toMatchObject({ survivors: [], seasonFinished: true });
    await expect(openNextRound(deps)).rejects.toMatchObject({ code: "conflict" });
  });

  it("supports a fully simulated demo player only when demo mode is on", async () => {
    await expect(registerDemoHuman(deps, ALICE)).rejects.toMatchObject({ code: "forbidden" });
    const demo = await makeDeps({ demoMode: true });
    await registerDemoHuman(demo, ALICE);
    const { reference } = await requestEntryPayment(demo, ALICE);
    const entered = await confirmDemoPayment(demo, ALICE, reference);
    expect(entered.status).toBe("alive");
    await openNextRound(demo);
    await passDemoCheckpoint(demo, ALICE);
    const view = await startPlay(demo, ALICE);
    expect(view.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect((await getOverview(demo, ALICE)).me?.checkpointPassed).toBe(true);
  });
});
