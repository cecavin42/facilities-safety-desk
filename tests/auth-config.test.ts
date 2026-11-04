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
