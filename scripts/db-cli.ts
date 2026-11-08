import { createPool } from "../src/lib/db/pool";
import { migrate, seed, seedSources } from "./database";

async function main() {
  const action = process.argv[2];
  if (!["migrate", "seed", "setup"].includes(action))
    throw new Error("Use migrate, seed or setup");
  // A Vercel preview build must never change a database, because Preview may
  // point at the production database. Set PREVIEW_DB_SETUP=1 for Preview to opt in.
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.PREVIEW_DB_SETUP !== "1"
  ) {
    console.log(
      `Preview build: database ${action} skipped. No database was changed.`,
    );
    return;
  }
  const pool = createPool(
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  );
  try {
    if (action !== "seed") await migrate(pool);
    if (action !== "migrate") await seed(pool);
    await seedSources(pool);
    console.log(`Database ${action} complete. Existing data preserved.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // The reason, with any connection string removed. Postgres error messages do
  // not contain passwords, and migration messages name only the file.
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message =
    error instanceof Error
      ? error.message.replace(/postgres(ql)?:\/\/\S+/gi, "[connection string]")
      : "unknown error";
  console.error(
    `Database setup failed${code ? ` (${code})` : ""}: ${message}\nCheck the server-side DATABASE_URL, database access, and migration history. No credentials were logged.`,
  );
  process.exitCode = 1;
});
