import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { getMigrations } from "better-auth/db/migration";
import { authOptions, createAuth } from "../src/lib/auth-config";
import { createPool } from "../src/lib/db/pool";
import { migrate, seed } from "./database";

async function main() {
  if (process.env.VERCEL)
    throw new Error("Local review accounts must not be provisioned on Vercel.");
  await mkdir(".local", { recursive: true });
  if (!existsSync(".env.local"))
    await writeFile(
      ".env.local",
      `DATABASE_URL=postgresql://postgres:local-auth-demo-only@127.0.0.1:54331/postgres\nBETTER_AUTH_URL=http://127.0.0.1:3103\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nASSISTANT_OLLAMA_MODEL=qwen3.6:35b-a3b\n`,
      { flag: "wx", mode: 0o600 },
    );
  process.loadEnvFile(".env.local");
  const url = new URL(process.env.DATABASE_URL!);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "54331" ||
    new URL(process.env.BETTER_AUTH_URL!).hostname !== "127.0.0.1"
  )
    throw new Error(
      "Local launcher requires its isolated loopback database and app URL.",
    );
  const directory = path.resolve(".test-db/auth");
  const postgres = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: "local-auth-demo-only",
    port: 54331,
    persistent: true,
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(path.join(directory, "PG_VERSION")))
    await postgres.initialise();
  await postgres.start();
  const pool = createPool();
  let child: ChildProcess | undefined;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    child?.kill();
    await pool.end();
    await postgres.stop();
  };
  process.once("SIGINT", () => {
    void stop().then(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void stop().then(() => process.exit(0));
  });
  try {
    if (process.argv.includes("--generate-schema")) {
      const migration = await getMigrations(authOptions(pool));
      await writeFile(
        "db/migrations/002_better_auth.sql",
        `-- Generated from Better Auth 1.7.16 with the admin plugin and database rate limits.\n${await migration.compileMigrations()}\n`,
        { flag: "wx" },
      );
      console.log("Generated reviewable authentication schema.");
      await stop();
      return;
    }
    await migrate(pool);
    await seed(pool);
    const file = ".local/review-accounts.json";
    type Account = {
      email: string;
      name: string;
      role: "admin" | "user";
      password: string;
    };
    let accounts: Account[];
    if (existsSync(file)) accounts = JSON.parse(await readFile(file, "utf8"));
    else {
      accounts = [
        {
          email: "admin@demo.invalid",
          name: "Demo Safety Manager",
          role: "admin",
        },
        {
          email: "employee-a@demo.invalid",
          name: "Demo Employee A",
          role: "user",
        },
        {
          email: "employee-b@demo.invalid",
          name: "Demo Employee B",
          role: "user",
        },
      ].map((a) => ({
        ...a,
        role: a.role as "admin" | "user",
        password: randomBytes(18).toString("base64url"),
      }));
      await writeFile(file, JSON.stringify(accounts, null, 2), {
        flag: "wx",
        mode: 0o600,
      });
    }
    const auth = createAuth(pool);
    for (const account of accounts) {
      const existing = await pool.query(
        'SELECT id FROM "user" WHERE email=$1',
        [account.email],
      );
      if (!existing.rowCount) await auth.api.createUser({ body: account });
    }
    console.log(
      "Isolated auth database ready on 127.0.0.1:54331. Review credentials are in .local/review-accounts.json (not Git).",
    );
    if (!process.argv.includes("--db-only")) {
      const next = path.resolve("node_modules/next/dist/bin/next");
      const code = await new Promise<number>((resolve) => {
        child = spawn(process.execPath, [next, "build"], {
          stdio: "inherit",
          env: process.env,
          windowsHide: true,
        });
        child.on("exit", (c) => resolve(c ?? 1));
      });
      if (code !== 0) throw new Error("Build failed");
      child = spawn(
        process.execPath,
        [next, "start", "--hostname", "127.0.0.1", "--port", "3103"],
        { stdio: "inherit", env: process.env, windowsHide: true },
      );
      child.on("exit", () => {
        void stop();
      });
    }
    await new Promise(() => {});
  } catch (error) {
    await stop();
    throw error;
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Local auth setup failed.",
  );
  process.exitCode = 1;
});
