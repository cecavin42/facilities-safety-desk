import { readFile, mkdir } from "node:fs/promises";
import { Pool } from "pg";
export const BASE = "http://127.0.0.1:3103";
export class Client {
  cookies = new Map<string, string>();
  async request(path: string, method = "GET", body?: unknown) {
    const form = body instanceof FormData;
    const r = await fetch(BASE + path, {
      method,
      headers: {
        Origin: BASE,
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(form ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
      redirect: "manual",
    });
    for (const value of r.headers.getSetCookie()) {
      const p = value.split(";", 1)[0];
      const i = p.indexOf("=");
      if (i > 0) {
        if (p.slice(i + 1)) this.cookies.set(p.slice(0, i), p.slice(i + 1));
        else this.cookies.delete(p.slice(0, i));
      }
    }
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: r.status, data, headers: r.headers };
  }
  login(email: string, password: string) {
    return this.request("/api/auth/sign-in/email", "POST", {
      email,
      password,
      rememberMe: false,
    });
  }
}
export async function localSetup() {
  await mkdir("test-results", { recursive: true });
  process.loadEnvFile(".env.local");
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.port !== "54331")
    throw new Error("Requires isolated local database.");
  const pool = new Pool({ connectionString: url.toString() });
  await pool.query('DELETE FROM "rateLimit";DELETE FROM auth_attempts');
  const accounts = JSON.parse(
    await readFile(".local/review-accounts.json", "utf8"),
  ) as { email: string; password: string; role: string }[];
  const admin = new Client();
  const a = accounts.find((a) => a.role === "admin")!;
  if ((await admin.login(a.email, a.password)).status !== 200)
    throw new Error("Local admin login failed.");
  return { pool, accounts, admin };
}
