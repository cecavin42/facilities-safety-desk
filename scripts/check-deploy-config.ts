// First step of the Vercel build (see vercel.json). A production build stops here,
// before any database migration, when a required setting is missing or malformed.
// Vercel then keeps serving the previous deployment. Setting values are never printed.
export {};

const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"];

function findProblems(env: NodeJS.ProcessEnv) {
  const problems = REQUIRED.filter((name) => !env[name]).map(
    (name) => `${name} is not set`,
  );
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
  // settings. They are optional, but a partial or malformed set stops the
  // build here, before the database step.
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

const target = process.env.VERCEL_ENV ?? "local";
const problems = findProblems(process.env);
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
    `Sign-in will not work on this ${target} build until these are fixed:\n${list}`,
  );
}
