import type { Row } from "@libsql/client";
import { SEASON_GAME_ORDER, isGameId } from "@/lib/games/registry";
import type { GameId } from "@/lib/games/types";
import type { Db } from "./client";

export type SeasonStatus = "registration" | "active" | "finished";
export type RoundStatus = "upcoming" | "open" | "closed";

export interface Season {
  readonly id: number;
  readonly name: string;
  readonly entryFeeUnits: bigint;
  readonly status: SeasonStatus;
}

export interface Round {
  readonly id: number;
  readonly seasonId: number;
  readonly number: number;
  readonly gameId: GameId;
  readonly status: RoundStatus;
  readonly opensAt: number | null;
  readonly closesAt: number | null;
}

function toSeason(row: Row): Season {
  return {
    id: Number(row.id),
    name: String(row.name),
    entryFeeUnits: BigInt(String(row.entry_fee_units)),
    status: String(row.status) as SeasonStatus,
  };
}

function toRound(row: Row): Round {
  const gameId = String(row.game_id);
  if (!isGameId(gameId)) throw new Error(`Unknown game id in DB: ${gameId}`);
  return {
    id: Number(row.id),
    seasonId: Number(row.season_id),
    number: Number(row.number),
    gameId,
    status: String(row.status) as RoundStatus,
    opensAt: row.opens_at === null ? null : Number(row.opens_at),
    closesAt: row.closes_at === null ? null : Number(row.closes_at),
  };
}

/** Idempotently creates the season and its 4 weekly rounds. */
export async function ensureSeason(db: Db, id: number, entryFeeUnits: bigint, now: number): Promise<Season> {
  await db.batch(
    [
      {
        sql: `INSERT OR IGNORE INTO seasons (id, name, entry_fee_units, status, created_at)
              VALUES (?, ?, ?, 'registration', ?)`,
        args: [id, `Season ${id}`, entryFeeUnits.toString(), now],
      },
      ...SEASON_GAME_ORDER.map((gameId, index) => ({
        sql: `INSERT OR IGNORE INTO rounds (season_id, number, game_id, status) VALUES (?, ?, ?, 'upcoming')`,
        args: [id, index + 1, gameId],
      })),
    ],
    "write",
  );
  const season = await getSeason(db, id);
  if (!season) throw new Error(`Season ${id} could not be created`);
  return season;
}

export async function getSeason(db: Db, id: number): Promise<Season | null> {
  const { rows } = await db.execute({ sql: "SELECT * FROM seasons WHERE id = ?", args: [id] });
  return rows[0] ? toSeason(rows[0]) : null;
}

export async function setSeasonStatus(db: Db, id: number, status: SeasonStatus): Promise<void> {
  await db.execute({ sql: "UPDATE seasons SET status = ? WHERE id = ?", args: [status, id] });
}

export async function listRounds(db: Db, seasonId: number): Promise<Round[]> {
  const { rows } = await db.execute({
    sql: "SELECT * FROM rounds WHERE season_id = ? ORDER BY number",
    args: [seasonId],
  });
  return rows.map(toRound);
}

export async function getRound(db: Db, roundId: number): Promise<Round | null> {
  const { rows } = await db.execute({ sql: "SELECT * FROM rounds WHERE id = ?", args: [roundId] });
  return rows[0] ? toRound(rows[0]) : null;
}

export async function openRound(db: Db, roundId: number, opensAt: number, closesAt: number): Promise<void> {
  await db.execute({
    sql: "UPDATE rounds SET status = 'open', opens_at = ?, closes_at = ? WHERE id = ? AND status = 'upcoming'",
    args: [opensAt, closesAt, roundId],
  });
}

export async function markRoundClosed(db: Db, roundId: number): Promise<void> {
  await db.execute({ sql: "UPDATE rounds SET status = 'closed' WHERE id = ?", args: [roundId] });
}

/** Total USDC (base units) confirmed into the season's prize pool. */
export async function getPoolUnits(db: Db, seasonId: number): Promise<bigint> {
  const { rows } = await db.execute({
    sql: "SELECT amount_units FROM payments WHERE season_id = ? AND status = 'confirmed'",
    args: [seasonId],
  });
  return rows.reduce((sum, row) => sum + BigInt(String(row.amount_units)), BigInt(0));
}
