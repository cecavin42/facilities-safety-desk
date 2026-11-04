# Facilities Safety Desk

Team A's fictional-data class project. Reports, status changes and assistant question statistics now use shared PostgreSQL storage. The document corpus and assistant search behavior are unchanged. Sign-in and role enforcement are still separate proposed work; use synthetic records only.

## Connect the team database (Vercel project owner)

1. In Catherine's **facilities-safety-desk** Vercel project, open **Storage** and create/connect **Neon Postgres** using an available free plan. Keep it in the account that owns the team app; do not connect an unrelated project's database.
2. Connect Production and Preview. Enable a separate database branch for previews, or connect a separate development database. Preview tests must not write into production. The integration supplies server-side `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Do not put either value in GitHub, Drive, browser code, or a `NEXT_PUBLIC_` variable.
3. Redeploy this branch's preview. `vercel.json` runs `npm run db:setup && npm run build`: versioned SQL migrations, then one-time demo seeding. It fails if the database is unavailable. Rerunning it preserves reports, statuses, question logs and the original seed dates.
4. In the preview, submit a synthetic report in one browser and find it in a second browser. Change its status and refresh the first. Check a CSV containing one valid and one invalid row, and the three report views. After team review/approval, merge through the existing PR workflow and repeat the shared-record check on production.

See [Neon's Vercel integration guide](https://neon.com/docs/guides/vercel-managed-integration). No paid plan is required by this code; review the plan offered during provisioning.

## Local database and checks

Requires Node.js 20.9 or newer. This repository includes a development-only PostgreSQL launcher; it binds to loopback and needs no Docker service.

```powershell
npm ci
npm run db:local
```

In a second terminal, use the deliberately non-secret **local-only** demo connection:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:local-demo-only@127.0.0.1:54330/postgres'
npm run dev
```

The database files stay in ignored `.test-db/local`. Ctrl+C stops the local database without deleting them. For a hosted development database, supply its private connection through your environment instead. `DATABASE_URL_UNPOOLED`, when set, is used for migrations; the app uses the pooled `DATABASE_URL`.

```powershell
npm run lint
npm run test:db
npm run test:unit
npm run build
# With the local production app running on port 3100:
npm run test:api
```

`test:db` starts an isolated real PostgreSQL instance and checks independent connections, concurrent IDs, duplicate-request handling, rollback, idempotent migrations/seeds, and request boundaries. `test:api` writes synthetic records only to a localhost app. The `db:migrate`, `db:seed`, and `db:setup` commands can also be run separately with the appropriate environment.

## Data behavior

- CSV previews reject malformed quotes, duplicate headers and inconsistent column counts; blank rows retain their original error row numbers. Oversized JSON batches are caught before submission, and replacing a selected file cannot import the previous preview.
- Form and CSV writes are confirmed by the server before showing success. The server applies the same validation as the browser, generates IDs and dates, and initializes status to Open. Confirmed batches are atomic; a retry with the same request ID returns the original records.
- Records/reports refresh on focus and every 15 seconds. Failed saves retain the form/import; failed reads show an error instead of silently falling back to browser storage.
- The original 150 incident records and 80 example questions are inserted once. There is no public reset endpoint or reset button that could erase another teammate's data.
- Previous browser records remain untouched. **Records → Reports saved in the previous browser demo → Export previous browser reports** downloads them. Review that CSV through **Upload CSV** before importing. Imports receive new IDs and Open status; the export preserves the old metadata. Old browser question history remains in the original browser storage.
- The app's existing public demo access is unchanged. CSRF checks are not user authentication. Real personnel/incident data must wait for approved sign-in and access controls.

## Current verification (Nov 3, 2026)

AI-assisted implementation by Codex at Forrest's direction. Seven local PostgreSQL integration checks, lint, production build and HTTP checks passed. In two Chrome profiles, a form-created report appeared in both, and a status change was visible across profiles. Follow-up checks in the ChatGPT browser verified CSV rejection/import, exported row contents, all three report views, fresh example-query logging, persistence across restart, and an import retry after a database outage. The Vercel setup-and-build command also passed against local PostgreSQL. Evidence screenshots are in the local ignored `test-results` folder.

Hosted Neon provisioning and Vercel deployment are not complete: Forrest's signed-in Vercel account could not access Catherine's project, and the ChatGPT browser reached the Vercel login page. The PR's Vercel preview has failed; its private build logs are unavailable to this account.

Next action: Catherine connects Neon to the team's Vercel project with isolated preview storage, then redeploys this PR preview. Repeat the shared-record and CSV checks on that hosted preview and obtain team review before merging. No student hours, review or approval are implied by these checks.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
