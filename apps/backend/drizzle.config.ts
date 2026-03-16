/**
 * drizzle.config.ts — Configuration for drizzle-kit CLI.
 *
 * drizzle-kit uses this to:
 *   - Find your schema files (to generate migrations)
 *   - Connect to your database (to apply migrations)
 *   - Run Drizzle Studio (visual DB browser)
 *
 * Commands:
 *   pnpm db:generate  — Generate a new migration from schema changes
 *   pnpm db:migrate   — Apply pending migrations to the database
 *   pnpm db:studio    — Open Drizzle Studio in the browser
 */

import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default {
  schema: "./src/db/schema/index.ts",  // Where to find table definitions
  out: "./drizzle",                     // Where to write migration files
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"],
  },
  verbose: true,   // Log SQL statements when generating migrations
  strict: true,    // Require confirmation before destructive migrations
} satisfies Config;
