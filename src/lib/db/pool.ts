import { Pool } from "pg";

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    allowExitOnIdle: true,
  });
  // Never log connection strings or raw driver errors (which can contain credentials).
  pool.on("error", () => console.error("An idle database connection failed."));
  return pool;
}
