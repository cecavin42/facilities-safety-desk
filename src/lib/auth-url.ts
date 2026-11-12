// Where sign-in lives, and which origins may post to the API.
//
// Production: BETTER_AUTH_URL, the address of the live site.
//
// Vercel preview: sign-in is available only when the preview has a database of
// its own, declared with PREVIEW_DB_SETUP=1 (a Neon preview branch; see
// docs/DEPLOYMENT.md). Such a preview takes its address from Vercel's VERCEL_URL
// (plus the branch alias in VERCEL_BRANCH_URL) and ignores BETTER_AUTH_URL, which
// names the live site. A preview that shares the live database gets no sign-in
// address at all, so unreviewed code there can never accept live passwords.
export function authOrigins(env: NodeJS.ProcessEnv = process.env) {
  if (env.VERCEL_ENV === "preview") {
    if (env.PREVIEW_DB_SETUP === "1" && env.VERCEL_URL) {
      const base = `https://${env.VERCEL_URL}`;
      const trusted = [base];
      if (env.VERCEL_BRANCH_URL)
        trusted.push(`https://${env.VERCEL_BRANCH_URL}`);
      return { base, trusted, preview: true };
    }
    return { base: undefined, trusted: [], preview: true };
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
