import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "pg-connection-string";
import { withFullSslVerification } from "../src/lib/db/pool";

const base = "postgres://app:pw@db.example.invalid/app";

test("SSL modes that pg 8 treats as verify-full are named verify-full", () => {
  for (const mode of ["require", "prefer", "verify-ca", "REQUIRE"])
    assert.equal(
      withFullSslVerification(`${base}?sslmode=${mode}&channel_binding=require`),
      `${base}?sslmode=verify-full&channel_binding=require`,
    );
  assert.equal(
    withFullSslVerification(`${base}?channel_binding=require&sslmode=require`),
    `${base}?channel_binding=require&sslmode=verify-full`,
  );
  // Left alone: no SSL mode, an explicit choice, or libpq semantics requested.
  for (const unchanged of [
    base,
    `${base}?sslmode=disable`,
    `${base}?sslmode=no-verify`,
    `${base}?sslmode=verify-full`,
    `${base}?uselibpqcompat=true&sslmode=require`,
  ])
    assert.equal(withFullSslVerification(unchanged), unchanged);
});

test("the rewrite keeps pg's TLS settings identical and emits no warning", async () => {
  const warnings: string[] = [];
  const listen = (w: Error) => warnings.push(w.message);
  process.on("warning", listen);
  try {
    const rewritten = parse(withFullSslVerification(`${base}?sslmode=require`));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(warnings.length, 0);
    const original = parse(`${base}?sslmode=require`);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(rewritten.ssl, original.ssl);
    // The unchanged string still triggers pg's warning, so the check above is real.
    assert.ok(warnings.some((m) => m.includes("treated as aliases for 'verify-full'")));
  } finally {
    process.off("warning", listen);
  }
});
