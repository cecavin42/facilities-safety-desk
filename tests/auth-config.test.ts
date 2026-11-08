import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { authOptions } from "../src/lib/auth-config";
test("auth configuration fails closed and uses secure cookies on HTTPS", () => {
  const secret = process.env.BETTER_AUTH_SECRET;
  const url = process.env.BETTER_AUTH_URL;
  const pool = new Pool();
  try {
    delete process.env.BETTER_AUTH_SECRET;
    assert.throws(() => authOptions(pool));
    process.env.BETTER_AUTH_SECRET = "test-secret-only-".repeat(4);
    process.env.BETTER_AUTH_URL = "http://example.invalid";
    assert.throws(() => authOptions(pool));
    process.env.BETTER_AUTH_URL = "ftp://127.0.0.1";
    assert.throws(() => authOptions(pool));
    process.env.BETTER_AUTH_URL = "https://review.example.invalid";
    const config = authOptions(pool);
    assert.equal(config.advanced.useSecureCookies, true);
    assert.equal(config.advanced.defaultCookieAttributes.httpOnly, true);
    assert.equal(config.session.cookieCache.enabled, false);
    assert.equal(config.session.disableSessionRefresh, true);
    assert.equal(config.emailAndPassword.disableSignUp, true);
    assert.equal(config.emailAndPassword.minPasswordLength, 15);
    assert.deepEqual(config.trustedOrigins, ["https://review.example.invalid"]);
  } finally {
    if (secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = secret;
    if (url === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = url;
    void pool.end();
  }
});
test("a Vercel preview signs in only with a database of its own, at its own address", () => {
  const names = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "PREVIEW_DB_SETUP",
  ] as const;
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  const pool = new Pool();
  try {
    process.env.BETTER_AUTH_SECRET = "test-secret-only-".repeat(4);
    process.env.BETTER_AUTH_URL = "https://live.example.invalid";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "preview-abc123.vercel.app";
    process.env.VERCEL_BRANCH_URL = "preview-git-branch.vercel.app";
    // A preview that shares the live database has no sign-in at all, even
    // though the live site's settings are present.
    delete process.env.PREVIEW_DB_SETUP;
    assert.throws(() => authOptions(pool));
    process.env.PREVIEW_DB_SETUP = "1";
    const preview = authOptions(pool);
    assert.equal(preview.baseURL, "https://preview-abc123.vercel.app");
    assert.deepEqual(preview.trustedOrigins, [
      "https://preview-abc123.vercel.app",
      "https://preview-git-branch.vercel.app",
    ]);
    assert.equal(preview.advanced.useSecureCookies, true);
    // A preview without BETTER_AUTH_URL still configures.
    delete process.env.BETTER_AUTH_URL;
    assert.equal(
      authOptions(pool).baseURL,
      "https://preview-abc123.vercel.app",
    );
    // Production ignores the Vercel address and uses the live-site setting.
    process.env.BETTER_AUTH_URL = "https://live.example.invalid";
    process.env.VERCEL_ENV = "production";
    const production = authOptions(pool);
    assert.equal(production.baseURL, "https://live.example.invalid");
    assert.deepEqual(production.trustedOrigins, [
      "https://live.example.invalid",
    ]);
  } finally {
    for (const n of names) {
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
    }
    void pool.end();
  }
});
