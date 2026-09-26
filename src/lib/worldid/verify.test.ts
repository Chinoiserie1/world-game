import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { describe, expect, it, vi } from "vitest";
import {
  VERIFY_URL,
  WorldIdError,
  assuranceFor,
  canonicalFieldElement,
  verifySessionProof,
  verifyUniquenessProof,
  type FetchLike,
} from "./verify";

const wallet = "0x1111111111111111111111111111111111111111";
const action = "world-game-s1-entry";

function uniquenessResult(overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce: "0x01",
    action,
    environment: "production",
    responses: [
      {
        identifier: "proof_of_human",
        signal_hash: hashSignal(wallet),
        proof: ["0x1", "0x2", "0x3", "0x4", "0x5"],
        nullifier: "0x00AB",
        issuer_schema_id: 1,
        expires_at_min: 1,
        ...item,
      },
    ],
    ...overrides,
  };
}

function sessionResult(sessionId = "session_abc", item: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce: "0x02",
    session_id: sessionId,
    environment: "production",
    responses: [
      {
        identifier: "proof_of_human",
        proof: ["0x1"],
        session_nullifier: ["0x0F", "0x99"],
        issuer_schema_id: 1,
        expires_at_min: 1,
        ...item,
      },
    ],
  };
}

function portal(status: number, body: unknown): FetchLike & ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const ctx = (fetchImpl: FetchLike) => ({ rpId: "rp_test", environment: "production" as const, fetchImpl });

describe("canonicalFieldElement", () => {
  it("normalises hex casing and padding", () => {
    expect(canonicalFieldElement("0x00ab")).toBe(canonicalFieldElement("0xAB"));
    expect(canonicalFieldElement("0xAB")).toBe("171");
  });

  it("rejects garbage", () => {
    expect(() => canonicalFieldElement("not-hex")).toThrow(WorldIdError);
  });
});

describe("assuranceFor", () => {
  it("only accepts Orb-backed Proof of Human", () => {
    expect(assuranceFor("proof_of_human")).toBe("high");
    expect(assuranceFor("orb")).toBe("high");
    for (const other of ["selfie", "face", "passport", "device"]) {
      expect(() => assuranceFor(other)).toThrow(WorldIdError);
    }
  });
});

describe("verifyUniquenessProof", () => {
  it("forwards the untouched result to the portal and returns the canonical nullifier", async () => {
    const raw = uniquenessResult();
    const fetchImpl = portal(200, { success: true, nullifier: "0x00ab", environment: "production", results: [] });
    const verified = await verifyUniquenessProof(raw, { action, signal: wallet }, ctx(fetchImpl));

    expect(verified).toEqual({ credential: "proof_of_human", assurance: "high", nullifier: "171" });
    expect(fetchImpl).toHaveBeenCalledWith(`${VERIFY_URL}/rp_test`, expect.objectContaining({ method: "POST" }));
    const sentBody = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body;
    expect(sentBody).toBe(JSON.stringify(raw));
  });

  it("rejects Selfie Check proofs before calling the portal", async () => {
    const fetchImpl = portal(200, { success: true });
    const raw = uniquenessResult({}, { identifier: "selfie", issuer_schema_id: 11, sybil_score: 3 });
    await expect(verifyUniquenessProof(raw, { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "credential_not_accepted",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a proof bound to another wallet before calling the portal", async () => {
    const fetchImpl = portal(200, { success: true });
    const raw = uniquenessResult({}, { signal_hash: hashSignal("0x2222222222222222222222222222222222222222") });
    await expect(verifyUniquenessProof(raw, { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "signal_mismatch",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects wrong action, environment and proof type", async () => {
    const fetchImpl = portal(200, { success: true });
    await expect(
      verifyUniquenessProof(uniquenessResult({ action: "other" }), { action, signal: wallet }, ctx(fetchImpl)),
    ).rejects.toMatchObject({ code: "action_mismatch" });
    await expect(
      verifyUniquenessProof(uniquenessResult({ environment: "staging" }), { action, signal: wallet }, ctx(fetchImpl)),
    ).rejects.toMatchObject({ code: "environment_mismatch" });
    await expect(verifyUniquenessProof(sessionResult(), { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "wrong_proof_type",
    });
    await expect(verifyUniquenessProof({ nope: true }, { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "invalid_payload",
    });
  });

  it("surfaces the portal error code", async () => {
    const fetchImpl = portal(400, { success: false, code: "all_verifications_failed", detail: "nope" });
    await expect(verifyUniquenessProof(uniquenessResult(), { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "all_verifications_failed",
    });
  });

  it("rejects when the portal verified in another environment", async () => {
    const fetchImpl = portal(200, { success: true, environment: "staging" });
    await expect(verifyUniquenessProof(uniquenessResult(), { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "environment_mismatch",
    });
  });

  it("handles an unreachable portal", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(verifyUniquenessProof(uniquenessResult(), { action, signal: wallet }, ctx(fetchImpl))).rejects.toMatchObject({
      code: "portal_unreachable",
    });
  });
});

describe("verifySessionProof", () => {
  it("accepts the enrolled session and returns the per-proof nullifier", async () => {
    const verified = await verifySessionProof(
      sessionResult("session_abc"),
      { sessionId: "session_abc" },
      ctx(portal(200, { success: true, session_id: "session_abc" })),
    );
    expect(verified).toEqual({ sessionId: "session_abc", sessionNullifier: "15", credential: "proof_of_human" });
  });

  it("allows creating a session when none is enrolled yet", async () => {
    const verified = await verifySessionProof(sessionResult("session_new"), { sessionId: null }, ctx(portal(200, { success: true })));
    expect(verified.sessionId).toBe("session_new");
  });

  it("blocks a different human (session mismatch) without calling the portal", async () => {
    const fetchImpl = portal(200, { success: true });
    await expect(
      verifySessionProof(sessionResult("session_other"), { sessionId: "session_abc" }, ctx(fetchImpl)),
    ).rejects.toMatchObject({ code: "session_mismatch" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects uniqueness proofs, missing nullifiers and portal session drift", async () => {
    await expect(
      verifySessionProof(uniquenessResult(), { sessionId: null }, ctx(portal(200, { success: true }))),
    ).rejects.toMatchObject({ code: "wrong_proof_type" });
    await expect(
      verifySessionProof(sessionResult("session_a", { session_nullifier: [] }), { sessionId: null }, ctx(portal(200, { success: true }))),
    ).rejects.toMatchObject({ code: "invalid_payload" });
    await expect(
      verifySessionProof(sessionResult("session_a"), { sessionId: null }, ctx(portal(200, { success: true, session_id: "session_b" }))),
    ).rejects.toMatchObject({ code: "session_mismatch" });
  });
});
