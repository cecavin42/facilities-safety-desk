import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Pool } from "pg";
const base = "http://127.0.0.1:3103";
// The main function verifies the isolated loopback database before calling this.
async function resetLocalRateCounters() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('DELETE FROM "rateLimit"; DELETE FROM auth_attempts');
  } finally {
    await pool.end();
  }
}
type Account = { email: string; password: string; role: string };
class Browser {
  cookies = new Map<string, string>();
  async request(path: string, method = "GET", body?: unknown, origin = base) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";", 1)[0];
      const i = pair.indexOf("=");
      if (i > 0) {
        const key = pair.slice(0, i);
        const value = pair.slice(i + 1);
        if (value) this.cookies.set(key, value);
        else this.cookies.delete(key);
      }
    }
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  }
  login(account: Account) {
    return this.request("/api/auth/sign-in/email", "POST", {
      email: account.email,
      password: account.password,
      rememberMe: false,
    });
  }
}
async function main() {
  process.loadEnvFile(".env.local");
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  if (databaseUrl.hostname !== "127.0.0.1" || databaseUrl.port !== "54331")
    throw new Error("Access tests require the isolated local auth database.");
  await resetLocalRateCounters();
  const accounts: Account[] = JSON.parse(
    await readFile(".local/review-accounts.json", "utf8"),
  );
  const a = new Browser(),
    b = new Browser(),
    admin = new Browser(),
    anon = new Browser();
  const results: { name: string; passed: boolean }[] = [];
  const check = async (name: string, work: () => Promise<void>) => {
    await work();
    results.push({ name, passed: true });
    console.log("PASS", name);
  };
  for (const path of [
    "/api/data",
    "/api/records/S-0001",
    "/api/admin/users",
    "/api/admin/audit",
  ])
    await check(`anonymous blocked: ${path}`, async () => {
      assert.equal((await anon.request(path)).status, 401);
    });
  await check(
    "public registration and built-in admin endpoints disabled",
    async () => {
      assert.equal(
        (await anon.request("/api/auth/sign-up/email", "POST", {})).status,
        404,
      );
      assert.equal(
        (await anon.request("/api/auth/admin/create-user", "POST", {})).status,
        404,
      );
    },
  );
  await check("real password sign-in and protected cookie", async () => {
    for (const [client, email] of [
      [a, "employee-a@demo.invalid"],
      [b, "employee-b@demo.invalid"],
      [admin, "admin@demo.invalid"],
    ] as const) {
      const r = await client.login(accounts.find((x) => x.email === email)!);
      assert.equal(r.status, 200, "Unexpected response status");
      assert.match(r.headers.getSetCookie().join(";"), /httponly/i);
      assert.match(r.headers.getSetCookie().join(";"), /samesite=lax/i);
    }
  });
  await check(
    "authenticated empty assistant question is rejected",
    async () => {
      assert.equal(
        (await a.request("/api/ask", "POST", { question: "" })).status,
        400,
      );
    },
  );
  const aData = (await a.request("/api/data")).data as {
    user: { id: string };
    records: unknown[];
  };
  const bData = (await b.request("/api/data")).data as {
    user: { id: string };
    records: unknown[];
  };
  const adminData = (await admin.request("/api/data")).data as {
    user: { id: string };
    records: unknown[];
  };
  const report = {
    eventDate: new Date().toISOString().slice(0, 10),
    eventTime: "09:30",
    location: "Loading dock",
    buildingName: "",
    shift: "Day",
    eventType: "Near miss",
    severity: "None",
    daysAway: null,
    equipment: "Forklift",
    description: `SYNTHETIC ACCESS CHECK ${randomUUID()}`,
    immediateAction: "Area cleared.",
    reporterName: "Demo Employee B",
    reporterEmail: "employee-b@demo.invalid",
  };
  const requestId = randomUUID();
  let id = "";
  await check(
    "creator ownership comes from session, not submitted reporter email",
    async () => {
      const r = await a.request("/api/records", "POST", {
        records: [report],
        requestId,
      });
      assert.equal(r.status, 201, "Unexpected response status");
      id = (r.data as { ids: string[] }).ids[0];
      assert.equal((await a.request(`/api/records/${id}`)).status, 200);
      assert.equal((await b.request(`/api/records/${id}`)).status, 404);
      assert.equal((await admin.request(`/api/records/${id}`)).status, 200);
    },
  );
  await check(
    "same-user retry is idempotent, another user cannot claim its batch",
    async () => {
      const retry = await a.request("/api/records", "POST", {
        records: [report],
        requestId,
      });
      assert.equal(retry.status, 201);
      assert.deepEqual((retry.data as { ids: string[] }).ids, [id]);
      assert.equal(
        (
          await b.request("/api/records", "POST", {
            records: [report],
            requestId,
          })
        ).status,
        409,
      );
    },
  );
  await check(
    "employee data contains no other owner's record or shared question log",
    async () => {
      const r = (await b.request("/api/data")).data as {
        records: { id: string }[];
        questions: unknown[];
      };
      assert.ok(!r.records.some((x) => x.id === id));
      assert.equal(r.questions.length, 0);
      assert.equal((await a.request("/api/records/S-0001")).status, 404);
    },
  );
  await check(
    "employee cannot change status, import or manage accounts",
    async () => {
      assert.equal(
        (
          await a.request(`/api/records/${id}`, "PATCH", {
            status: "Closed",
            role: "admin",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await a.request("/api/import", "POST", {
            records: [report],
            requestId: randomUUID(),
          })
        ).status,
        403,
      );
      assert.equal((await a.request("/api/admin/users")).status, 403);
      assert.equal(
        (
          await a.request(`/api/admin/users/${aData.user.id}`, "PATCH", {
            role: "admin",
            active: true,
          })
        ).status,
        403,
      );
    },
  );
  await check("record owner and status forgery rejected", async () => {
    assert.equal(
      (
        await a.request("/api/records", "POST", {
          records: [{ ...report, created_by: bData.user.id, status: "Closed" }],
          requestId: randomUUID(),
        })
      ).status,
      400,
    );
  });
  await check(
    "administrator can update status; stale version is rejected",
    async () => {
      const before = (await admin.request(`/api/records/${id}`)).data as {
        updatedAt: string;
      };
      assert.equal(
        (
          await admin.request(`/api/records/${id}`, "PATCH", {
            status: "Closed",
            expectedUpdatedAt: before.updatedAt,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await admin.request(`/api/records/${id}`, "PATCH", {
            status: "Open",
            expectedUpdatedAt: before.updatedAt,
          })
        ).status,
        409,
      );
    },
  );
  await check("cross-site mutations rejected", async () => {
    assert.equal(
      (
        await admin.request(
          "/api/records",
          "POST",
          { records: [report], requestId: randomUUID() },
          "https://untrusted.invalid",
        )
      ).status,
      403,
    );
  });
  await check(
    "administrator import validates and deduplicates atomically",
    async () => {
      const row = {
        ...report,
        description: `SYNTHETIC IMPORT ACCESS ${randomUUID()}`,
      };
      const r = await admin.request("/api/import", "POST", {
        records: [row, row],
        requestId: randomUUID(),
      });
      assert.equal(r.status, 201);
      assert.equal((r.data as { ids: string[] }).ids.length, 1);
      assert.equal((r.data as { duplicateCount: number }).duplicateCount, 1);
      assert.equal(
        (
          await admin.request("/api/import", "POST", {
            records: [row, { ...row, reporterEmail: "bad" }],
            requestId: randomUUID(),
          })
        ).status,
        400,
      );
    },
  );
  await check(
    "administrator cannot disable or demote own last-admin account",
    async () => {
      assert.equal(
        (
          await admin.request(
            `/api/admin/users/${adminData.user.id}`,
            "PATCH",
            { role: "user", active: false },
          )
        ).status,
        400,
      );
    },
  );
  await check(
    "disabled account loses its existing session and cannot sign in",
    async () => {
      try {
        assert.equal(
          (
            await admin.request(`/api/admin/users/${bData.user.id}`, "PATCH", {
              role: "user",
              active: false,
            })
          ).status,
          200,
        );
        assert.equal((await b.request("/api/data")).status, 401);
        assert.notEqual(
          (
            await b.login(
              accounts.find((x) => x.email === "employee-b@demo.invalid")!,
            )
          ).status,
          200,
        );
      } finally {
        assert.equal(
          (
            await admin.request(`/api/admin/users/${bData.user.id}`, "PATCH", {
              role: "user",
              active: true,
            })
          ).status,
          200,
        );
      }
    },
  );
  await check(
    "role change revokes sessions and new session receives current role",
    async () => {
      try {
        await b.login(
          accounts.find((x) => x.email === "employee-b@demo.invalid")!,
        );
        assert.equal(
          (
            await admin.request(`/api/admin/users/${bData.user.id}`, "PATCH", {
              role: "admin",
              active: true,
            })
          ).status,
          200,
        );
        assert.equal((await b.request("/api/data")).status, 401);
        assert.equal(
          (
            await b.login(
              accounts.find((x) => x.email === "employee-b@demo.invalid")!,
            )
          ).status,
          200,
        );
        assert.equal((await b.request("/api/admin/users")).status, 200);
      } finally {
        await admin.request(`/api/admin/users/${bData.user.id}`, "PATCH", {
          role: "user",
          active: true,
        });
      }
    },
  );
  await check(
    "admin creates an approved employee without exposing password hashes",
    async () => {
      const email = `review-${randomUUID()}@demo.invalid`;
      const password = randomBytes(18).toString("base64url");
      const r = await admin.request("/api/admin/users", "POST", {
        name: "Temporary access test",
        email,
        password,
        role: "user",
      });
      assert.equal(r.status, 201, "Unexpected response status");
      const userId = (r.data as { id: string }).id;
      const first = new Browser();
      const second = new Browser();
      assert.equal(
        (await first.login({ email, password, role: "user" })).status,
        200,
      );
      assert.equal(
        (await second.login({ email, password, role: "user" })).status,
        200,
      );
      const replacement = randomBytes(18).toString("base64url");
      assert.equal(
        (
          await first.request("/api/auth/change-password", "POST", {
            currentPassword: "wrong-password-for-test",
            newPassword: replacement,
            revokeOtherSessions: true,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await first.request("/api/auth/change-password", "POST", {
            currentPassword: password,
            newPassword: replacement,
            revokeOtherSessions: true,
          })
        ).status,
        200,
      );
      assert.equal((await second.request("/api/data")).status, 401);
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        const stored = await pool.query(
          'SELECT password FROM "account" WHERE "userId"=$1',
          [userId],
        );
        assert.ok(
          stored.rows[0].password !== password &&
            stored.rows[0].password !== replacement,
        );
        await pool.query(
          'UPDATE "session" SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',
          [userId],
        );
        assert.equal((await first.request("/api/data")).status, 401);
      } finally {
        await pool.end();
      }
      await admin.request(`/api/admin/users/${userId}`, "PATCH", {
        role: "user",
        active: false,
      });
      const listing = await admin.request("/api/admin/users");
      assert.doesNotMatch(
        JSON.stringify(listing.data),
        /password|session_token/i,
      );
    },
  );
  await check(
    "logout revokes the server session, not only the browser cookie",
    async () => {
      const stolen = new Browser();
      stolen.cookies = new Map(a.cookies);
      assert.equal(
        (await a.request("/api/auth/sign-out", "POST", {})).status,
        200,
      );
      assert.equal((await stolen.request("/api/data")).status, 401);
    },
  );
  await check("forged cookie cannot authenticate", async () => {
    const forged = new Browser();
    forged.cookies.set("fsa.session_token", "fake.admin.token");
    assert.equal((await forged.request("/api/data")).status, 401);
  });
  await check("unknown-account brute force is throttled", async () => {
    const email = `throttle-${randomUUID()}@demo.invalid`;
    let status = 0;
    for (let i = 0; i < 11; i++)
      status = (
        await anon.request("/api/auth/sign-in/email", "POST", {
          email,
          password: "Invalid-demo-password",
        })
      ).status;
    assert.equal(status, 429);
  });
  await check("audit records actions without credential material", async () => {
    const r = await admin.request("/api/admin/audit");
    assert.equal(r.status, 200);
    const text = JSON.stringify(r.data);
    assert.match(text, /report.created/);
    assert.match(text, /account.access_changed/);
    for (const account of accounts) assert.ok(!text.includes(account.password));
  });
  await resetLocalRateCounters();
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/access-checks.json",
    JSON.stringify(
      { passed: results.length, total: results.length, results },
      null,
      2,
    ),
  );
  console.log(`Access checks: ${results.length}/${results.length} passed`);
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Access checks failed",
  );
  process.exitCode = 1;
});
