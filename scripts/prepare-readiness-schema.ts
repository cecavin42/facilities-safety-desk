import { writeFile } from "node:fs/promises";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/lib/auth-config";
import { createPool } from "../src/lib/db/pool";
async function main() {
  process.loadEnvFile(".env.local");
  const pool = createPool();
  try {
    const migration = await getMigrations(authOptions(pool));
    await writeFile(
      "db/migrations/004_two_factor.sql",
      `-- Generated from Better Auth 1.7.16 two-factor plugin.\n${await migration.compileMigrations()}\n`,
      { flag: "wx" },
    );
    console.log("Generated the MFA schema migration.");
  } finally {
    await pool.end();
  }
}
void main();
