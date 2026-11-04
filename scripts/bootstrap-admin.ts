import { existsSync } from "node:fs";
import { createPool } from "../src/lib/db/pool";
import { createAuth } from "../src/lib/auth-config";
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (process.env.FSA_ALLOW_ADMIN_BOOTSTRAP !== "1")
    throw new Error(
      "Explicitly set FSA_ALLOW_ADMIN_BOOTSTRAP=1 for the first administrator.",
    );
  const email = process.env.FSA_ADMIN_EMAIL;
  const name = process.env.FSA_ADMIN_NAME;
  const password = process.env.FSA_ADMIN_PASSWORD;
  if (!email || !name || !password || password.length < 15)
    throw new Error(
      "Provide the approved administrator name, email and a password of at least 15 characters through the environment.",
    );
  const pool = createPool();
  try {
    const existing = await pool.query(
      "SELECT id FROM \"user\" WHERE role='admin' AND COALESCE(banned,false)=false",
    );
    if (existing.rowCount)
      throw new Error(
        "An active administrator already exists. Use authenticated account management.",
      );
    await createAuth(pool).api.createUser({
      body: { name, email, password, role: "admin" },
    });
    console.log("First administrator created. No credentials were printed.");
  } finally {
    await pool.end();
    delete process.env.FSA_ADMIN_PASSWORD;
  }
}
main().catch(() => {
  console.error(
    "Administrator bootstrap did not complete. Check setup, approved account inputs and whether an administrator already exists.",
  );
  process.exitCode = 1;
});
