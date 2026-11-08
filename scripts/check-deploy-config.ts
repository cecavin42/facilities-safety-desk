// First step of the Vercel build (see vercel.json). A production build stops here,
// before any database migration, when a required setting is missing or malformed,
// or when the deployment would go live with nobody able to sign in.
// Vercel then keeps serving the previous deployment. Setting values are never printed.
//
// Preview builds: a preview without a database of its own (PREVIEW_DB_SETUP not
// set) has no sign-in, so nothing is checked. A preview with PREVIEW_DB_SETUP=1
// is checked like production, and stops if its Preview settings are incomplete.
import { createPool } from "../src/lib/db/pool";

function settingProblems(env: NodeJS.ProcessEnv, target: string) {
  const required =
    target === "preview"
      ? ["DATABASE_URL", "BETTER_AUTH_SECRET"]
      : ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];
  const problems = required
    .filter((name) => !env[name])
    .map((name) => `${name} is not set`);
  const secret = env.BETTER_AUTH_SECRET;
  if (secret && secret.length < 32)
    problems.push("BETTER_AUTH_SECRET must be at least 32 characters");
  const baseUrl = env.BETTER_AUTH_URL;
  if (baseUrl && target !== "preview") {
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "https:")
        problems.push("BETTER_AUTH_URL must start with https://");
      // Vercel names the production host itself; a typo in the setting would
      // otherwise go live and break every sign-in.
      const productionHost = env.VERCEL_PROJECT_PRODUCTION_URL;
      if (
        target === "production" &&
        productionHost &&
        url.host !== productionHost
      )
        problems.push(
          `BETTER_AUTH_URL must be https://${productionHost} (the project's production address)`,
        );
    } catch {
      problems.push("BETTER_AUTH_URL is not a valid URL");
    }
  }
  return problems;
}

// The first administrator is created during the build from these three
// settings. A partial or malformed set is reported here.
function adminSettingProblems(env: NodeJS.ProcessEnv) {
  const problems: string[] = [];
  const admin = [
    env.FSA_ADMIN_NAME,
    env.FSA_ADMIN_EMAIL,
    env.FSA_ADMIN_PASSWORD,
  ];
  if (!admin.some(Boolean)) return problems;
  if (!admin.every(Boolean))
    problems.push(
      "FSA_ADMIN_NAME, FSA_ADMIN_EMAIL and FSA_ADMIN_PASSWORD must all be set, or none of them",
    );
  if (
    env.FSA_ADMIN_EMAIL &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.FSA_ADMIN_EMAIL)
  )
    problems.push("FSA_ADMIN_EMAIL is not an email address");
  if (
    env.FSA_ADMIN_PASSWORD &&
    (env.FSA_ADMIN_PASSWORD.length < 15 || env.FSA_ADMIN_PASSWORD.length > 128)
  )
    problems.push("FSA_ADMIN_PASSWORD must be 15 to 128 characters");
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
  if (target === "preview" && env.PREVIEW_DB_SETUP !== "1") {
    console.log(
      'Preview build: sign-in is off on this preview, because it has no database of its own. To review by preview, see docs/DEPLOYMENT.md, "Previews that can sign in".',
    );
    return;
  }
  const problems = settingProblems(env, target);
  const adminProblems = adminSettingProblems(env);
  const adminSettingsPresent = Boolean(
    env.FSA_ADMIN_NAME || env.FSA_ADMIN_EMAIL || env.FSA_ADMIN_PASSWORD,
  );
  if (target === "production") {
    const exists = problems.length ? undefined : await administratorExists(env);
    if (exists === true) {
      // Leftover administrator settings must never block a later deployment.
      if (adminSettingsPresent)
        console.log(
          "An administrator already exists. The FSA_ADMIN settings are not needed and can be removed.",
        );
    } else {
      problems.push(...adminProblems);
      // Sign-in is useless without an administrator. If none exists and the
      // deployment is not going to create one, stop instead of locking the site.
      if (exists === false && !adminSettingsPresent)
        problems.push(
          "No administrator exists yet, and FSA_ADMIN_NAME, FSA_ADMIN_EMAIL and FSA_ADMIN_PASSWORD are not set",
        );
    }
  } else {
    problems.push(...adminProblems);
  }
  const list = problems.map((problem) => `- ${problem}`).join("\n");
  if (!problems.length) {
    console.log(
      `Deployment settings check passed (${target}${target === "preview" ? ", own database" : ""}).`,
    );
  } else if (target === "production") {
    console.error(
      `Production build stopped. No database change was made.\n${list}\nAdd the settings in the Vercel project, then redeploy. See docs/DEPLOYMENT.md.`,
    );
    process.exitCode = 1;
  } else if (target === "preview") {
    console.error(
      `Preview build stopped. PREVIEW_DB_SETUP=1 is set for Preview, so these must be right for the Preview environment:\n${list}\nSee docs/DEPLOYMENT.md, "Previews that can sign in".`,
    );
    process.exitCode = 1;
  } else {
    console.warn(
      `Sign-in will not work on this ${target} build until these are fixed:\n${list}`,
    );
  }
}

main().catch(() => {
  console.error("The deployment settings check could not run.");
  process.exitCode = 1;
});
