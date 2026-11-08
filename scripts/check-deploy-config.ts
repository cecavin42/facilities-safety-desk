// First step of the Vercel build (see vercel.json). A production build stops here,
// before any database migration, when a required setting is missing or malformed,
// or when the deployment would go live with nobody able to sign in.
// Vercel then keeps serving the previous deployment. Setting values are never printed.
import { createPool } from "../src/lib/db/pool";

// A preview works out its own address from Vercel's VERCEL_URL, so it does not
// need BETTER_AUTH_URL. It still needs the secret and the database.
function required(target: string) {
  return target === "preview"
    ? ["DATABASE_URL", "BETTER_AUTH_SECRET"]
    : ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
}

function findProblems(env: NodeJS.ProcessEnv, target: string) {
  const problems = required(target)
    .filter((name) => !env[name])
    .map((name) => `${name} is not set`);
  const secret = env.BETTER_AUTH_SECRET;
  if (secret && secret.length < 32)
    problems.push("BETTER_AUTH_SECRET must be at least 32 characters");
  const baseUrl = env.BETTER_AUTH_URL;
  if (baseUrl) {
    try {
      if (new URL(baseUrl).protocol !== "https:")
        problems.push("BETTER_AUTH_URL must start with https://");
    } catch {
      problems.push("BETTER_AUTH_URL is not a valid URL");
    }
  }
  // The first administrator is created during the build from these three
  // settings. A partial or malformed set stops the build here.
  const admin = [
    env.FSA_ADMIN_NAME,
    env.FSA_ADMIN_EMAIL,
    env.FSA_ADMIN_PASSWORD,
  ];
  if (admin.some(Boolean)) {
    if (!admin.every(Boolean))
      problems.push(
        "FSA_ADMIN_NAME, FSA_ADMIN_EMAIL and FSA_ADMIN_PASSWORD must all be set, or none of them",
      );
    if (
      env.FSA_ADMIN_EMAIL &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.FSA_ADMIN_EMAIL)
    )
      problems.push("FSA_ADMIN_EMAIL is not an email address");
    if (env.FSA_ADMIN_PASSWORD && env.FSA_ADMIN_PASSWORD.length < 15)
      problems.push("FSA_ADMIN_PASSWORD must be at least 15 characters");
  }
  return problems;
}

// Read-only. Answers undefined when the database cannot be read; the database
// step that follows then reports the connection problem itself.
async function administratorExists(env: NodeJS.ProcessEnv) {
  let pool: ReturnType<typeof createPool> | undefined;
  try {
    pool = createPool(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);
    const {
      rows: [table],
    } = await pool.query(`SELECT to_regclass('public."user"') AS name`);
    if (!table?.name) return false;
    const found = await pool.query(
      "SELECT 1 FROM \"user\" WHERE role='admin' AND COALESCE(banned,false)=false LIMIT 1",
    );
    return Boolean(found.rowCount);
  } catch {
    return undefined;
  } finally {
    await pool?.end().catch(() => {});
  }
}

async function main() {
  const env = process.env;
  const target = env.VERCEL_ENV ?? "local";
  const problems = findProblems(env, target);
  // Sign-in is useless without an administrator. If none exists and the
  // deployment is not going to create one, stop instead of locking the site.
  if (
    target === "production" &&
    !problems.length &&
    !env.FSA_ADMIN_NAME &&
    !env.FSA_ADMIN_EMAIL &&
    !env.FSA_ADMIN_PASSWORD &&
    (await administratorExists(env)) === false
  )
    problems.push(
      "No administrator exists yet, and FSA_ADMIN_NAME, FSA_ADMIN_EMAIL and FSA_ADMIN_PASSWORD are not set",
    );
  const list = problems.map((problem) => `- ${problem}`).join("\n");
  if (!problems.length) {
    console.log(`Deployment settings check passed (${target}).`);
  } else if (target === "production") {
    console.error(
      `Production build stopped. No database change was made.\n${list}\nAdd the settings in the Vercel project, then redeploy. See docs/DEPLOYMENT.md.`,
    );
    process.exitCode = 1;
  } else {
    console.warn(
      target === "preview"
        ? `Sign-in will not work on this preview until these are set for the Preview environment in Vercel:\n${list}`
        : `Sign-in will not work on this ${target} build until these are fixed:\n${list}`,
    );
  }
}

main().catch(() => {
  console.error("The deployment settings check could not run.");
  process.exitCode = 1;
});
