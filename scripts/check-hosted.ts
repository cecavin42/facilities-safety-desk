import assert from "node:assert/strict";
async function main() {
  const raw = process.env.FSA_SMOKE_BASE_URL;
  const email = process.env.FSA_SMOKE_EMAIL;
  const password = process.env.FSA_SMOKE_PASSWORD;
  if (!raw || !email || !password)
    throw new Error(
      "Set FSA_SMOKE_BASE_URL, FSA_SMOKE_EMAIL and FSA_SMOKE_PASSWORD for an approved review account.",
    );
  const base = new URL(raw);
  if (base.protocol !== "https:" || base.username || base.password)
    throw new Error("Hosted smoke checks require an explicit HTTPS origin.");
  const origin = base.origin;
  const anonymous = await fetch(origin + "/api/data", { redirect: "manual" });
  assert.equal(
    anonymous.status,
    401,
    "Anonymous data access must be denied. If preview protection intervenes, arrange access with the project owner.",
  );
  const login = await fetch(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe: false }),
    redirect: "manual",
  });
  assert.equal(login.status, 200, "Approved account sign-in did not succeed.");
  const body = await login.json();
  if (body.twoFactorRedirect)
    throw new Error(
      "MFA is active. Complete the hosted sign-in and review manually; this script does not bypass MFA.",
    );
  const cookies = login.headers.getSetCookie();
  assert.ok(
    cookies.some(
      (c) =>
        /httponly/i.test(c) && /secure/i.test(c) && /samesite=lax/i.test(c),
    ),
    "Secure session cookie attributes are required.",
  );
  const cookie = cookies.map((c) => c.split(";", 1)[0]).join("; ");
  try {
    const data = await fetch(origin + "/api/data", {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    assert.equal(data.status, 200);
    assert.match(data.headers.get("cache-control") || "", /no-store/);
    const value = await data.json();
    assert.ok(Array.isArray(value.records) && value.user?.id);
    console.log(
      "HTTPS sign-in, protected data access and cache headers passed. No incident or account changes were submitted.",
    );
  } finally {
    await fetch(origin + "/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  }
  const after = await fetch(origin + "/api/data", {
    headers: { Cookie: cookie },
    cache: "no-store",
  });
  assert.equal(after.status, 401);
  console.log("Server-side logout revocation passed.");
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Hosted checks failed");
  process.exitCode = 1;
});
