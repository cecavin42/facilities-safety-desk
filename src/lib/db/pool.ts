import { Pool } from "pg";

// pg 8 already treats sslmode=prefer, require and verify-ca as verify-full
// (encrypted, certificate and host name checked) and warns that pg 9 will give
// them the weaker libpq meanings. Naming verify-full keeps today's behaviour
// through that upgrade and removes the build-log warning. A connection string
// that opts into libpq semantics with uselibpqcompat=true is left as written.
export function withFullSslVerification(connectionString: string) {
  if (/[?&]uselibpqcompat=true(?=&|#|$)/i.test(connectionString))
    return connectionString;
  return connectionString.replace(
    /([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|#|$)/gi,
    "$1verify-full",
  );
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const pool = new Pool({
    connectionString: withFullSslVerification(connectionString),
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
