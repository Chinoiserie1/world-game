import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { z } from "zod";
import type { Assurance } from "@/lib/db/players";

/**
 * Server-side World ID 4.0 verification.
 *
 * The IDKit result is forwarded byte-for-byte to the Developer Portal; we only
 * *read* fields locally to enforce app-level policy (action, signal binding,
 * environment, credential tier) and to extract the replay-protection values.
 */

export const VERIFY_URL = "https://developer.world.org/api/v4/verify";

export class WorldIdError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorldIdError";
  }
}

const responseItemSchema = z
  .object({
    identifier: z.string(),
    signal_hash: z.string().optional(),
    nullifier: z.string().optional(),
    session_nullifier: z.array(z.string()).optional(),
  })
  .loose();

const resultSchema = z
  .object({
    protocol_version: z.enum(["3.0", "4.0"]),
    nonce: z.string(),
    action: z.string().optional(),
    session_id: z.string().optional(),
    environment: z.string(),
    responses: z.array(responseItemSchema).min(1),
  })
  .loose();

export type IdkitResultShape = z.infer<typeof resultSchema>;

const portalSuccessSchema = z
  .object({
    success: z.literal(true),
    nullifier: z.string().optional(),
    session_id: z.string().optional(),
    environment: z.string().optional(),
  })
  .loose();

const portalErrorSchema = z.object({ code: z.string().optional(), detail: z.string().optional() }).loose();

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface VerifyContext {
  readonly rpId: string;
  readonly environment: "production" | "staging" | "sandbox";
  readonly fetchImpl?: FetchLike;
}

/** 256-bit field elements → canonical decimal string (avoids hex casing/padding bugs). */
export function canonicalFieldElement(value: string): string {
  try {
    return BigInt(value).toString(10);
  } catch {
    throw new WorldIdError("invalid_payload", "Malformed field element in proof");
  }
}

/** Only Orb-backed Proof of Human (4.0, or legacy 3.0 "orb") gives a seat: one human, one seat. */
const CREDENTIAL_ASSURANCE: Readonly<Record<string, Assurance>> = {
  proof_of_human: "high",
  orb: "high",
};

export function assuranceFor(identifier: string): Assurance {
  const assurance = CREDENTIAL_ASSURANCE[identifier];
  if (!assurance) {
    throw new WorldIdError("credential_not_accepted", `Credential "${identifier}" is not accepted: World Game requires an Orb-verified World ID`);
  }
  return assurance;
}

export function parseIdkitResult(raw: unknown): IdkitResultShape {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) throw new WorldIdError("invalid_payload", "Malformed IDKit result");
  return parsed.data;
}

async function forwardToPortal(raw: unknown, ctx: VerifyContext): Promise<z.infer<typeof portalSuccessSchema>> {
  const doFetch = ctx.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${VERIFY_URL}/${encodeURIComponent(ctx.rpId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
  } catch (error) {
    throw new WorldIdError("portal_unreachable", `World ID verifier unreachable: ${String(error)}`);
  }
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = portalErrorSchema.safeParse(body);
    const code = err.success ? (err.data.code ?? "verification_failed") : "verification_failed";
    const detail = err.success ? (err.data.detail ?? "Proof rejected") : "Proof rejected";
    throw new WorldIdError(code, detail);
  }
  const ok = portalSuccessSchema.safeParse(body);
  if (!ok.success) throw new WorldIdError("verification_failed", "Unexpected verifier response");
  if (ok.data.environment && ok.data.environment !== ctx.environment) {
    throw new WorldIdError("environment_mismatch", `Proof verified in ${ok.data.environment}, expected ${ctx.environment}`);
  }
  return ok.data;
}

function assertEnvironment(result: IdkitResultShape, ctx: VerifyContext): void {
  if (result.environment !== ctx.environment) {
    throw new WorldIdError("environment_mismatch", `Proof from ${result.environment}, expected ${ctx.environment}`);
  }
}

export interface UniquenessVerification {
  readonly credential: string;
  readonly assurance: Assurance;
  readonly nullifier: string;
}

/**
 * Verifies a one-time uniqueness proof (season entry): correct action, proof
 * bound to the signed-in wallet, valid on the World ID protocol.
 */
export async function verifyUniquenessProof(
  raw: unknown,
  expected: { action: string; signal: string },
  ctx: VerifyContext,
): Promise<UniquenessVerification> {
  const result = parseIdkitResult(raw);
  if (result.session_id) throw new WorldIdError("wrong_proof_type", "Expected a uniqueness proof, got a session");
  if (result.action !== expected.action) throw new WorldIdError("action_mismatch", "Proof is for another action");
  assertEnvironment(result, ctx);

  const item = result.responses[0];
  const assurance = assuranceFor(item.identifier);
  const expectedSignalHash = canonicalFieldElement(hashSignal(expected.signal));
  if (!item.signal_hash || canonicalFieldElement(item.signal_hash) !== expectedSignalHash) {
    throw new WorldIdError("signal_mismatch", "Proof is not bound to your wallet");
  }

  const portal = await forwardToPortal(raw, ctx);
  const nullifierHex = portal.nullifier ?? item.nullifier;
  if (!nullifierHex) throw new WorldIdError("invalid_payload", "Missing nullifier");

  return {
    credential: item.identifier,
    assurance,
    nullifier: canonicalFieldElement(nullifierHex),
  };
}

export interface SessionVerification {
  readonly sessionId: string;
  readonly sessionNullifier: string;
  readonly credential: string;
}

/**
 * Verifies a session proof. When `expectedSessionId` is given the proof must be
 * for that exact session — i.e. the same human who entered the season.
 */
export async function verifySessionProof(
  raw: unknown,
  expected: { sessionId: string | null },
  ctx: VerifyContext,
): Promise<SessionVerification> {
  const result = parseIdkitResult(raw);
  if (!result.session_id) throw new WorldIdError("wrong_proof_type", "Expected a session proof");
  if (expected.sessionId && result.session_id !== expected.sessionId) {
    throw new WorldIdError("session_mismatch", "This is not the World ID that entered the season");
  }
  assertEnvironment(result, ctx);

  const item = result.responses[0];
  assuranceFor(item.identifier);
  const sessionNullifierHex = item.session_nullifier?.[0];
  if (!sessionNullifierHex) throw new WorldIdError("invalid_payload", "Missing session nullifier");

  const portal = await forwardToPortal(raw, ctx);
  if (portal.session_id && portal.session_id !== result.session_id) {
    throw new WorldIdError("session_mismatch", "Verifier returned a different session");
  }

  return {
    sessionId: result.session_id,
    sessionNullifier: canonicalFieldElement(sessionNullifierHex),
    credential: item.identifier,
  };
}
