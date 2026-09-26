import type { Row } from "@libsql/client";
import { isUniqueViolation, type Db } from "./client";

/* ---------- World ID replay protection ---------- */

/** Per-proof replay protection for session proofs. */
export async function consumeSessionNullifier(db: Db, nullifier: string, now: number): Promise<boolean> {
  try {
    await db.execute({
      sql: "INSERT INTO session_nullifiers (nullifier, created_at) VALUES (?, ?)",
      args: [nullifier, now],
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/* ---------- Payments into the prize pool (entries + sponsor top-ups) ---------- */

export type PaymentKind = "entry" | "topup";

export interface Payment {
  readonly reference: string;
  readonly seasonId: number;
  readonly address: string;
  readonly kind: PaymentKind;
  readonly amountUnits: bigint;
  readonly status: "pending" | "confirmed";
  readonly transactionId: string | null;
}

function toPayment(row: Row): Payment {
  return {
    reference: String(row.reference),
    seasonId: Number(row.season_id),
    address: String(row.address),
    kind: String(row.kind) as PaymentKind,
    amountUnits: BigInt(String(row.amount_units)),
    status: String(row.status) as Payment["status"],
    transactionId: row.transaction_id === null ? null : String(row.transaction_id),
  };
}

export async function createPayment(
  db: Db,
  p: { reference: string; seasonId: number; address: string; kind: PaymentKind; amountUnits: bigint; now: number },
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO payments (reference, season_id, address, kind, amount_units, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    args: [p.reference, p.seasonId, p.address, p.kind, p.amountUnits.toString(), p.now],
  });
}

export async function getPayment(db: Db, reference: string): Promise<Payment | null> {
  const { rows } = await db.execute({ sql: "SELECT * FROM payments WHERE reference = ?", args: [reference] });
  return rows[0] ? toPayment(rows[0]) : null;
}

export async function confirmPayment(db: Db, reference: string, transactionId: string): Promise<boolean> {
  try {
    const result = await db.execute({
      sql: "UPDATE payments SET status = 'confirmed', transaction_id = ? WHERE reference = ? AND status = 'pending'",
      args: [transactionId, reference],
    });
    return result.rowsAffected === 1;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export interface TopUpStats {
  readonly totalUnits: bigint;
  readonly sponsors: number;
  readonly top: ReadonlyArray<{ address: string; amountUnits: bigint }>;
}

/** Confirmed sponsor top-ups for a season, with the biggest sponsors first. */
export async function getTopUpStats(db: Db, seasonId: number, limit = 5): Promise<TopUpStats> {
  const { rows } = await db.execute({
    sql: `SELECT address, amount_units FROM payments
          WHERE season_id = ? AND kind = 'topup' AND status = 'confirmed'`,
    args: [seasonId],
  });
  const bySponsor = rows.reduce<ReadonlyMap<string, bigint>>((acc, row) => {
    const address = String(row.address);
    return new Map(acc).set(address, (acc.get(address) ?? BigInt(0)) + BigInt(String(row.amount_units)));
  }, new Map());
  const sorted = [...bySponsor.entries()]
    .map(([address, amountUnits]) => ({ address, amountUnits }))
    .sort((a, b) => (a.amountUnits === b.amountUnits ? 0 : a.amountUnits > b.amountUnits ? -1 : 1));
  return {
    totalUnits: sorted.reduce((sum, s) => sum + s.amountUnits, BigInt(0)),
    sponsors: sorted.length,
    top: sorted.slice(0, limit),
  };
}

/* ---------- Prize claims ---------- */

export interface Claim {
  readonly seasonId: number;
  readonly address: string;
  readonly amountUnits: bigint;
  readonly status: "pending" | "paid";
  readonly txHash: string | null;
}

function toClaim(row: Row): Claim {
  return {
    seasonId: Number(row.season_id),
    address: String(row.address),
    amountUnits: BigInt(String(row.amount_units)),
    status: String(row.status) as Claim["status"],
    txHash: row.tx_hash === null ? null : String(row.tx_hash),
  };
}

export async function getClaim(db: Db, seasonId: number, address: string): Promise<Claim | null> {
  const { rows } = await db.execute({
    sql: "SELECT * FROM claims WHERE season_id = ? AND address = ?",
    args: [seasonId, address],
  });
  return rows[0] ? toClaim(rows[0]) : null;
}

/** Creates the claim once; returns false if it already exists. */
export async function createClaim(
  db: Db,
  c: { seasonId: number; address: string; amountUnits: bigint; now: number },
): Promise<boolean> {
  try {
    await db.execute({
      sql: `INSERT INTO claims (season_id, address, amount_units, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
      args: [c.seasonId, c.address, c.amountUnits.toString(), c.now],
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

export async function markClaimPaid(db: Db, seasonId: number, address: string, txHash: string): Promise<void> {
  await db.execute({
    sql: "UPDATE claims SET status = 'paid', tx_hash = ? WHERE season_id = ? AND address = ?",
    args: [txHash, seasonId, address],
  });
}
