import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Database client.
 *
 * Local development uses a file-backed SQLite database (`DATABASE_URL=file:./data/app.db`).
 * Production points the same URL at Turso/libSQL — every query in the app goes
 * through Drizzle, so nothing else changes between the two.
 *
 * This replaced `better-sqlite3`, which cannot run on Vercel: it is a native
 * module that wants a writable local filesystem, and serverless functions have
 * neither a persistent one nor a shared one between invocations. libSQL speaks
 * the same SQL over HTTP, so the schema and every query survived the swap
 * unchanged — the only difference is that the driver is asynchronous, which is
 * why every function in `lib/queries.ts` returns a promise.
 *
 * Next.js hot-reloads modules in dev, so the client is cached on globalThis to
 * avoid opening a new connection on every file save.
 */

const globalForDb = globalThis as unknown as {
  __dbClient?: ReturnType<typeof createClient>;
};

// `DATABASE_FILE` is the older name this project used when it was still on
// better-sqlite3; it is still honoured so an existing local .env keeps working.
const url =
  process.env.DATABASE_URL ??
  (process.env.DATABASE_FILE
    ? `file:${process.env.DATABASE_FILE.replace(/^file:/, "")}`
    : "file:./data/app.db");

const client =
  globalForDb.__dbClient ??
  createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__dbClient = client;

export const db = drizzle(client, { schema });
export { schema };
