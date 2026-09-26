/**
 * SQLite schema. Nullifiers are stored as canonical decimal strings (a 256-bit
 * integer does not fit SQLite INTEGER) under UNIQUE constraints — this is the
 * only replay protection for World ID proofs, so never "upsert" them.
 */
export const SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    entry_fee_units TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('registration','active','finished')),
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS season_players (
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    address TEXT NOT NULL,
    credential TEXT NOT NULL,
    assurance TEXT NOT NULL CHECK (assurance IN ('high','demo')),
    session_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('verified','alive','eliminated','winner')),
    eliminated_round INTEGER,
    verified_at INTEGER NOT NULL,
    entered_at INTEGER,
    PRIMARY KEY (season_id, address)
  )`,
  `CREATE TABLE IF NOT EXISTS nullifiers (
    action TEXT NOT NULL,
    nullifier TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (action, nullifier)
  )`,
  `CREATE TABLE IF NOT EXISTS session_nullifiers (
    nullifier TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    reference TEXT PRIMARY KEY,
    season_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('entry','topup')),
    amount_units TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','confirmed')),
    transaction_id TEXT UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    number INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming','open','closed')),
    opens_at INTEGER,
    closes_at INTEGER,
    UNIQUE (season_id, number)
  )`,
  `CREATE TABLE IF NOT EXISTS round_checks (
    round_id INTEGER NOT NULL REFERENCES rounds(id),
    address TEXT NOT NULL,
    verified_at INTEGER NOT NULL,
    PRIMARY KEY (round_id, address)
  )`,
  `CREATE TABLE IF NOT EXISTS plays (
    id TEXT PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES rounds(id),
    address TEXT NOT NULL,
    seed TEXT NOT NULL,
    commitment TEXT NOT NULL,
    state_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active','finished')),
    score INTEGER,
    choice TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    UNIQUE (round_id, address)
  )`,
  `CREATE TABLE IF NOT EXISTS claims (
    season_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    amount_units TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','paid')),
    tx_hash TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (season_id, address)
  )`,
];
