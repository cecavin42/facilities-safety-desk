import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/lib/client-api";

test("invalid authenticator codes remain on the challenge and show the server error", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () =>
      Response.json(
        { code: "INVALID_CODE", message: "Invalid verification code" },
        { status: 401 },
      );
    // There is deliberately no window: a redirect would fail this assertion.
    await assert.rejects(
      api(
        "/api/auth/two-factor/verify-totp",
        { method: "POST" },
        { redirectOnUnauthorized: false },
      ),
      /Invalid verification code/,
    );
  } finally {
    global.fetch = original;
  }
});
