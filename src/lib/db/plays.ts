import type { Row } from "@libsql/client";
import { isUniqueViolation, type Db } from "./client";

export interface Play {
  readonly id: string;
  readonly roundId: number;
  readonly address: string;
  readonly seed: string;
  readonly commitment: string;
  readonly state: unknown;
  readonly status: "active" | "finished";
  readonly score: number | null;
  readonly choice: string | null;
  readonly startedAt: number;
  readonly finishedAt: number | null;
}

function toPlay(row: Row): Play {
  return {
    id: String(row.id),
    roundId: Number(row.round_id),
    address: String(row.address),
    seed: String(row.seed),
    commitment: String(row.commitment),
    state: JSON.parse(String(row.state_json)) as unknown,
    status: String(row.status) as Play["status"],
    score: row.score === null ? null : Number(row.score),
    choice: row.choice === null ? null : String(row.choice),
    startedAt: Number(row.started_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
  };
}

export async function getPlay(db: Db, roundId: number, address: string): Promise<Play | null> {
  const { rows } = await db.execute({
    sql: "SELECT * FROM plays WHERE round_id = ? AND address = ?",
    args: [roundId, address],
  });
  return rows[0] ? toPlay(rows[0]) : null;
}

/** One play per player per round. Returns null if a play already exists. */
export async function createPlay(
  db: Db,
  p: { id: string; roundId: number; address: string; seed: string; commitment: string; state: unknown; now: number },
): Promise<Play | null> {
  try {
    await db.execute({
      sql: `INSERT INTO plays (id, round_id, address, seed, commitment, state_json, status, started_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
      args: [p.id, p.roundId, p.address, p.seed, p.commitment, JSON.stringify(p.state), p.now],
    });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
  return getPlay(db, p.roundId, p.address);
}

/**
 * Optimistic update: only succeeds if the stored state is still `expectedState`,
 * so two concurrent moves cannot both apply.
 */
export async function savePlayState(
  db: Db,
  play: Play,
  next: { state: unknown; finished: boolean; score: number; choice: string | null; now: number },
): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE plays SET state_json = ?, status = ?, score = ?, choice = ?, finished_at = ?
          WHERE id = ? AND status = 'active' AND state_json = ?`,
    args: [
      JSON.stringify(next.state),
      next.finished ? "finished" : "active",
      next.score,
      next.choice,
      next.finished ? next.now : null,
      play.id,
      JSON.stringify(play.state),
    ],
  });
  return result.rowsAffected === 1;
}

export async function listPlays(db: Db, roundId: number): Promise<Play[]> {
  const { rows } = await db.execute({ sql: "SELECT * FROM plays WHERE round_id = ?", args: [roundId] });
  return rows.map(toPlay);
}

/* ---------- Weekly identity checkpoints ---------- */

export async function recordRoundCheck(db: Db, roundId: number, address: string, now: number): Promise<void> {
  await db.execute({
    sql: "INSERT OR IGNORE INTO round_checks (round_id, address, verified_at) VALUES (?, ?, ?)",
    args: [roundId, address, now],
  });
}

export async function hasRoundCheck(db: Db, roundId: number, address: string): Promise<boolean> {
  const { rows } = await db.execute({
    sql: "SELECT 1 FROM round_checks WHERE round_id = ? AND address = ?",
    args: [roundId, address],
  });
  return rows.length > 0;
}
