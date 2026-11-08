// Where sign-in lives, and which origins may post to the API.
//
// Production: BETTER_AUTH_URL, the address of the live site.
// Vercel preview: every preview has its own address, so it is taken from Vercel's
// VERCEL_URL (plus the branch alias in VERCEL_BRANCH_URL). BETTER_AUTH_URL is
// ignored there, because it names the live site and its cookies would not work
// on a preview address. This is what lets a reviewer sign in on a preview.
export function authOrigins(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    const base = `https://${env.VERCEL_URL}`;
    const trusted = [base];
    if (env.VERCEL_BRANCH_URL) trusted.push(`https://${env.VERCEL_BRANCH_URL}`);
    return { base, trusted, preview: true };
  }
  const base = env.BETTER_AUTH_URL;
  let origin: string | undefined;
  try {
    origin = base ? new URL(base).origin : undefined;
  } catch {
    origin = undefined;
  }
  return { base, trusted: origin ? [origin] : [], preview: false };
}
