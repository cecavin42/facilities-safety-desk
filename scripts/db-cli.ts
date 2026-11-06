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

main().catch(() => {
  console.error(
    "Database setup failed. Check the server-side DATABASE_URL, database access, and migration history. No credentials were logged.",
  );
  process.exitCode = 1;
});
