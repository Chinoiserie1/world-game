import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { getConfig } from "@/lib/config";
import { SCHEMA } from "./schema";

export type Db = Client;

export async function migrate(db: Db): Promise<void> {
  await db.batch([...SCHEMA], "write");
}

function ensureLocalDir(url: string): void {
  if (!url.startsWith("file:") || url === "file::memory:") return;
  const filePath = url.slice("file:".length);
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export async function createDb(url: string, authToken?: string): Promise<Db> {
  ensureLocalDir(url);
  const db = createClient({ url, authToken });
  await migrate(db);
  return db;
}

let shared: Promise<Db> | null = null;

/** Process-wide client, lazily created and migrated on first use. */
export function getDb(): Promise<Db> {
  if (!shared) {
    const { DATABASE_URL, DATABASE_AUTH_TOKEN } = getConfig();
    shared = createDb(DATABASE_URL, DATABASE_AUTH_TOKEN).catch((error: unknown) => {
      shared = null;
      throw error;
    });
  }
  return shared;
}

export function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(message);
}
