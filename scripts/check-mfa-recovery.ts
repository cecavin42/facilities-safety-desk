import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { Client, localSetup } from "./readiness-client";
function totp(uri: string) {
  const u = new URL(uri);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of u.searchParams.get("secret")!.replace(/=/g, "").toUpperCase())
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const off = h[19] & 15;
  return ((h.readUInt32BE(off) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
async function main() {
  const { pool, accounts, admin } = await localSetup();
  const results: string[] = [];
  let id = "";
  try {
    const email = `mfa-${randomUUID()}@demo.invalid`;
    const password = randomBytes(20).toString("base64url");
    const created = await admin.request("/api/admin/users", "POST", {
      name: "MFA recovery fixture",
      email,
      password,
      role: "admin",
    });
    assert.equal(created.status, 201);
    id = created.data.id;
    const user = new Client();
    assert.equal((await user.login(email, password)).status, 200);
    const beforeMfa = new Client();
    assert.equal((await beforeMfa.login(email, password)).status, 200);
    const enabled = await user.request("/api/auth/two-factor/enable", "POST", {
      password,
      method: "totp",
    });
    assert.equal(enabled.status, 200);
    assert.ok(enabled.data.totpURI && enabled.data.backupCodes.length);
    assert.equal(
      (await user.request("/api/account/security")).data.enabled,
      false,
    );
    assert.equal(
      (
        await user.request("/api/auth/two-factor/verify-totp", "POST", {
          code: totp(enabled.data.totpURI),
          trustDevice: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await user.request("/api/account/security")).data.enabled,
      true,
      "Verified enrollment must leave the current session usable",
    );
    assert.equal((await beforeMfa.request("/api/data")).status, 401);
    results.push(
      "TOTP enrollment requires verification and revokes old password-only sessions",
    );
    await user.request("/api/auth/sign-out", "POST", {});
    const pending = await user.login(email, password);
    assert.equal(pending.data.twoFactorRedirect, true);
    assert.equal((await user.request("/api/data")).status, 401);
    assert.equal((await user.request("/api/admin/users")).status, 401);
    assert.notEqual(
      (
        await user.request("/api/auth/two-factor/verify-totp", "POST", {
          code: "invalid",
          trustDevice: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await user.request("/api/auth/two-factor/verify-totp", "POST", {
          code: totp(enabled.data.totpURI),
          trustDevice: false,
        })
      ).status,
      200,
    );
    assert.equal((await user.request("/api/data")).status, 200);
    results.push(
      "Password alone cannot access data; valid TOTP completes sign-in",
    );
    await user.request("/api/auth/sign-out", "POST", {});
    await user.login(email, password);
    assert.equal(
      (
        await user.request("/api/auth/two-factor/verify-backup-code", "POST", {
          code: enabled.data.backupCodes[0],
          trustDevice: false,
        })
      ).status,
      200,
    );
    await user.request("/api/auth/sign-out", "POST", {});
    await user.login(email, password);
    assert.notEqual(
      (
        await user.request("/api/auth/two-factor/verify-backup-code", "POST", {
          code: enabled.data.backupCodes[0],
          trustDevice: false,
        })
      ).status,
      200,
    );
    assert.equal((await user.request("/api/data")).status, 401);
    await pool.query('DELETE FROM "rateLimit"');
    assert.equal(
      (
        await user.request("/api/auth/two-factor/verify-backup-code", "POST", {
          code: enabled.data.backupCodes[1],
          trustDevice: false,
        })
      ).status,
      200,
    );
    results.push("Backup codes work once and cannot be replayed");
    const issued = await admin.request(
      `/api/admin/users/${id}/recovery`,
      "POST",
      {},
    );
    assert.equal(issued.status, 200);
    const token = new URLSearchParams(
      new URL(issued.data.url).hash.slice(1),
    ).get("token")!;
    const stored = await pool.query(
      "SELECT token_hash FROM account_recovery WHERE user_id=$1 AND used_at IS NULL",
      [id],
    );
    assert.equal(
      stored.rows[0].token_hash,
      createHash("sha256").update(token).digest("hex"),
    );
    const replacement = randomBytes(20).toString("base64url");
    const anon = new Client();
    const simultaneous = await Promise.all([
      anon.request("/api/recovery", "POST", { token, password: replacement }),
      new Client().request("/api/recovery", "POST", {
        token,
        password: replacement,
      }),
    ]);
    assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 400]);
    assert.equal((await user.request("/api/data")).status, 401);
    results.push(
      "Recovery token is stored hashed, consumed once under concurrency, and revokes sessions",
    );
    await pool.query('DELETE FROM "rateLimit"');
    const recovered = new Client();
    assert.equal(
      (await recovered.login(email, replacement)).data.twoFactorRedirect,
      true,
    );
    assert.equal((await recovered.request("/api/data")).status, 401);
    assert.equal(
      (
        await recovered.request(
          "/api/auth/two-factor/verify-backup-code",
          "POST",
          { code: enabled.data.backupCodes[2], trustDevice: false },
        )
      ).status,
      200,
    );
    assert.equal((await recovered.request("/api/data")).status, 200);
    results.push("Password recovery does not bypass MFA");
    const second = await admin.request(
      `/api/admin/users/${id}/recovery`,
      "POST",
      {},
    );
    const expired = new URLSearchParams(
      new URL(second.data.url).hash.slice(1),
    ).get("token")!;
    await pool.query(
      "UPDATE account_recovery SET expires_at=now()-interval '1 second' WHERE user_id=$1",
      [id],
    );
    assert.equal(
      (
        await anon.request("/api/recovery", "POST", {
          token: expired,
          password: replacement,
        })
      ).status,
      400,
    );
    const employee = new Client();
    const ea = accounts.find((a) => a.role === "user")!;
    await employee.login(ea.email, ea.password);
    assert.equal(
      (await employee.request(`/api/admin/users/${id}/recovery`, "POST", {}))
        .status,
      403,
    );
    results.push(
      "Expired links and employee-issued recovery requests are rejected",
    );
    await pool.query(
      'UPDATE "session" SET mfa_verified=false WHERE "userId"=$1',
      [id],
    );
    assert.equal((await recovered.request("/api/data")).status, 401);
    assert.equal(
      (
        await recovered.request("/api/auth/change-password", "POST", {
          currentPassword: replacement,
          newPassword: password,
          revokeOtherSessions: true,
        })
      ).status,
      401,
    );
    results.push(
      "Sessions without server-recorded MFA verification cannot access data or change passwords",
    );
    await writeFile(
      "test-results/mfa-recovery-checks.json",
      JSON.stringify({ passed: results.length, results }, null, 2),
    );
    console.log(results.map((r) => "PASS " + r).join("\n"));
  } finally {
    if (id)
      await admin.request(`/api/admin/users/${id}`, "PATCH", {
        role: "user",
        active: false,
      });
    await pool.query('DELETE FROM "rateLimit";DELETE FROM auth_attempts');
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "MFA checks failed");
  process.exitCode = 1;
});
