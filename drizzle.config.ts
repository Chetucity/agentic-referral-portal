import type { Config } from "drizzle-kit";
import "dotenv/config";

/**
 * Drizzle Kit configuration.
 *
 * `turso` is the dialect for libSQL, which covers both ends of the deployment:
 * a local `file:` URL in development and a Turso database in production. The
 * schema is identical either way, so `db:push` behaves the same against both.
 */
const url =
  process.env.DATABASE_URL ??
  (process.env.DATABASE_FILE
    ? `file:${process.env.DATABASE_FILE.replace(/^file:/, "")}`
    : "file:./data/app.db");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
