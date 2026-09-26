import type { Row } from "@libsql/client";
import type { Db } from "./client";

export type PlayerStatus = "verified" | "alive" | "eliminated" | "winner";
export type Assurance = "high" | "demo";

export interface SeasonPlayer {
  readonly seasonId: number;
  readonly address: string;
  readonly credential: string;
  readonly assurance: Assurance;
  readonly sessionId: string | null;
  readonly status: PlayerStatus;
  readonly eliminatedRound: number | null;
  readonly verifiedAt: number;
  readonly enteredAt: number | null;
}

function toPlayer(row: Row): SeasonPlayer {
  return {
    seasonId: Number(row.season_id),
    address: String(row.address),
    credential: String(row.credential),
    assurance: String(row.assurance) as Assurance,
    sessionId: row.session_id === null ? null : String(row.session_id),
    status: String(row.status) as PlayerStatus,
    eliminatedRound: row.eliminated_round === null ? null : Number(row.eliminated_round),
    verifiedAt: Number(row.verified_at),
    enteredAt: row.entered_at === null ? null : Number(row.entered_at),
  };
}

export async function getPlayer(db: Db, seasonId: number, address: string): Promise<SeasonPlayer | null> {
  const { rows } = await db.execute({
    sql: "SELECT * FROM season_players WHERE season_id = ? AND address = ?",
    args: [seasonId, address],
  });
  return rows[0] ? toPlayer(rows[0]) : null;
}

/** Binds a World ID session once; refuses to silently replace an existing one. */
export async function bindSession(db: Db, seasonId: number, address: string, sessionId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE season_players SET session_id = ?
          WHERE season_id = ? AND address = ? AND session_id IS NULL`,
    args: [sessionId, seasonId, address],
  });
  return result.rowsAffected === 1;
}

export async function markEntered(db: Db, seasonId: number, address: string, now: number): Promise<void> {
  await db.execute({
    sql: `UPDATE season_players SET status = 'alive', entered_at = ?
          WHERE season_id = ? AND address = ? AND status = 'verified'`,
    args: [now, seasonId, address],
  });
}

export async function listPlayersByStatus(db: Db, seasonId: number, status: PlayerStatus): Promise<SeasonPlayer[]> {
  const { rows } = await db.execute({
    sql: "SELECT * FROM season_players WHERE season_id = ? AND status = ? ORDER BY entered_at",
    args: [seasonId, status],
  });
  return rows.map(toPlayer);
}

export async function countPlayersByStatus(db: Db, seasonId: number): Promise<Record<PlayerStatus, number>> {
  const { rows } = await db.execute({
    sql: "SELECT status, COUNT(*) AS n FROM season_players WHERE season_id = ? GROUP BY status",
    args: [seasonId],
  });
  const empty: Record<PlayerStatus, number> = { verified: 0, alive: 0, eliminated: 0, winner: 0 };
  return rows.reduce((acc, row) => ({ ...acc, [String(row.status)]: Number(row.n) }), empty);
}

export async function eliminatePlayers(db: Db, seasonId: number, addresses: readonly string[], round: number) {
  if (addresses.length === 0) return;
  await db.batch(
    addresses.map((address) => ({
      sql: `UPDATE season_players SET status = 'eliminated', eliminated_round = ?
            WHERE season_id = ? AND address = ? AND status = 'alive'`,
      args: [round, seasonId, address],
    })),
    "write",
  );
}

export async function crownWinners(db: Db, seasonId: number, addresses: readonly string[]) {
  if (addresses.length === 0) return;
  await db.batch(
    addresses.map((address) => ({
      sql: "UPDATE season_players SET status = 'winner' WHERE season_id = ? AND address = ? AND status = 'alive'",
      args: [seasonId, address],
    })),
    "write",
  );
}
