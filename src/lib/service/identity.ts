import { entryActionFor } from "./actions";
import { ServiceError, type ServiceDeps } from "./deps";
import { consumeSessionNullifier } from "@/lib/db/ledger";
import { bindSession, getPlayer, type SeasonPlayer } from "@/lib/db/players";
import { getSeason } from "@/lib/db/seasons";
import { isUniqueViolation } from "@/lib/db/client";
import {
  WorldIdError,
  assuranceFor,
  verifySessionProof,
  verifyUniquenessProof,
  type SessionVerification,
} from "@/lib/worldid/verify";

function worldIdFailure(error: unknown): never {
  if (error instanceof WorldIdError) {
    const code = error.code === "portal_unreachable" ? "unavailable" : "forbidden";
    throw new ServiceError(code, error.message, error.code);
  }
  throw error;
}

async function requireRegistrationOpen(deps: ServiceDeps): Promise<void> {
  const season = await getSeason(deps.db, deps.seasonId);
  if (!season) throw new ServiceError("not_found", "Season not found");
  if (season.status !== "registration") {
    throw new ServiceError("forbidden", "Registrations are closed for this season", "registration_closed");
  }
}

async function insertVerifiedPlayer(
  deps: ServiceDeps,
  p: { address: string; action: string; nullifier: string; credential: string; assurance: string },
): Promise<void> {
  const now = deps.now();
  try {
    // Atomic: the nullifier is only burned if the player row is created too.
    await deps.db.batch(
      [
        { sql: "INSERT INTO nullifiers (action, nullifier, created_at) VALUES (?, ?, ?)", args: [p.action, p.nullifier, now] },
        {
          sql: `INSERT INTO season_players (season_id, address, credential, assurance, status, verified_at)
                VALUES (?, ?, ?, ?, 'verified', ?)`,
          args: [deps.seasonId, p.address, p.credential, p.assurance, now],
        },
      ],
      "write",
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("nullifiers")) {
      throw new ServiceError("conflict", "This World ID already entered this season", "nullifier_replayed");
    }
    throw new ServiceError("conflict", "This wallet is already registered", "already_registered");
  }
}

/**
 * Step 1 — the Sybil gate. One uniqueness proof per human per season, bound to
 * the signed-in wallet. Only Orb-verified World ID (Proof of Human) is accepted.
 */
export async function registerHuman(deps: ServiceDeps, address: string, idkitResult: unknown): Promise<SeasonPlayer> {
  await requireRegistrationOpen(deps);
  if (await getPlayer(deps.db, deps.seasonId, address)) {
    throw new ServiceError("conflict", "This wallet is already registered", "already_registered");
  }

  const action = entryActionFor(deps.seasonId);
  const verified = await verifyUniquenessProof(idkitResult, { action, signal: address }, deps.worldId).catch(worldIdFailure);

  await insertVerifiedPlayer(deps, { address, action, ...verified });
  const player = await getPlayer(deps.db, deps.seasonId, address);
  if (!player) throw new Error("Player vanished after insert");
  return player;
}

/** Demo-only shortcut so judges can try the game without World App. */
export async function registerDemoHuman(deps: ServiceDeps, address: string): Promise<SeasonPlayer> {
  if (!deps.demoMode) throw new ServiceError("forbidden", "Demo mode is disabled");
  await requireRegistrationOpen(deps);
  await insertVerifiedPlayer(deps, {
    address,
    action: "demo",
    nullifier: `demo:${address}`,
    credential: "demo",
    assurance: "demo",
  });
  await bindSession(deps.db, deps.seasonId, address, `session_demo_${address}`);
  const player = await getPlayer(deps.db, deps.seasonId, address);
  if (!player) throw new Error("Player vanished after insert");
  return player;
}

export async function requirePlayer(deps: ServiceDeps, address: string): Promise<SeasonPlayer> {
  const player = await getPlayer(deps.db, deps.seasonId, address);
  if (!player) throw new ServiceError("forbidden", "Verify your World ID first", "not_registered");
  return player;
}

/**
 * Verifies a session proof and burns its per-proof nullifier. When the player
 * already has a session, the proof must be for that exact session.
 */
export async function proveSameHuman(deps: ServiceDeps, player: SeasonPlayer, idkitResult: unknown): Promise<SessionVerification> {
  const verified = await verifySessionProof(idkitResult, { sessionId: player.sessionId }, deps.worldId).catch(
    worldIdFailure,
  );
  if (player.assurance !== "demo" && assuranceFor(verified.credential) !== player.assurance) {
    throw new ServiceError("forbidden", "Use the same credential you entered with", "credential_mismatch");
  }
  const fresh = await consumeSessionNullifier(deps.db, verified.sessionNullifier, deps.now());
  if (!fresh) throw new ServiceError("conflict", "This proof was already used", "session_replayed");
  return verified;
}

/** Step 2 — lock the identity: bind a World ID session to the season entry. */
export async function lockIdentity(deps: ServiceDeps, address: string, idkitResult: unknown): Promise<SeasonPlayer> {
  const player = await requirePlayer(deps, address);
  if (player.sessionId) throw new ServiceError("conflict", "Identity already locked", "session_already_bound");

  const verified = await proveSameHuman(deps, player, idkitResult);
  const bound = await bindSession(deps.db, deps.seasonId, address, verified.sessionId);
  if (!bound) throw new ServiceError("conflict", "Identity already locked", "session_already_bound");
  const updated = await getPlayer(deps.db, deps.seasonId, address);
  if (!updated) throw new Error("Player vanished");
  return updated;
}

