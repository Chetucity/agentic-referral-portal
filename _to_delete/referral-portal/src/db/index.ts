import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_FILE = process.env.DATABASE_FILE ?? "./data/app.db";

// Reuse the connection across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
};

const sqlite =
  globalForDb.sqlite ??
  (() => {
    const conn = new Database(DB_FILE);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    return conn;
  })();

if (process.env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
