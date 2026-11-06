# Deploying this version

For the Vercel project owner. Read this before merging the pull request that adds sign-in.

## What changes on the live site

- Every page and every data request requires sign-in. There is no public view.
- Existing records stay. The database changes only add tables and columns.
- Nobody can sign in until the first administrator is created (step 4). That is a one-time command.

## Before merging

**1. Add two settings in Vercel** (Project → Settings → Environment Variables), for the Production environment:

| Setting | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | A random string of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `BETTER_AUTH_URL` | `https://facilities-safety-desk.vercel.app` with nothing after `.app`. |

`DATABASE_URL` is already set from the shared-storage work.

- Keep a private copy of `BETTER_AUTH_SECRET`. A backup can only be restored with the same value.
- Do not put either value in GitHub, Drive or a `NEXT_PUBLIC_` variable.
- Do not set `ASSISTANT_OLLAMA_MODEL` on Vercel.

**2. Check which database the Preview environment uses.** Every build runs `npm run db:setup`, and that includes the preview build of each pull request. If Preview points at the same database as Production, opening or updating a pull request applies its migrations to the production database before anyone has reviewed it. Preview should have its own database or database branch.

## What the production build does

The build command in `vercel.json` runs three steps in order:

1. `npm run check:deploy` confirms the three settings exist and are well formed. If one is missing, the build stops here, nothing in the database changes, and Vercel keeps serving the previous deployment.
2. `npm run db:setup` applies the migrations that have not run yet and loads the five bundled source documents. It is safe to run again: existing reports, statuses and question logs are kept.
3. `npm run build` builds the app.

| Migration | Adds |
| --- | --- |
| `001_shared_storage` | Already applied in production. Unchanged. |
| `002_better_auth` | Tables for users, sessions, accounts, verification and rate limits |
| `003_access_controls` | An owner column on reports and questions, an audit log, sign-in attempt limits |
| `004_two_factor` | Authenticator (MFA) data |
| `005_recovery_and_sources` | Recovery links and source document versions |
| `006_session_mfa_assurance` | A flag on each session recording that MFA was completed |

## After the first production deployment

**3. Confirm the site asks for sign-in.** Opening the site should show the sign-in page. Opening `/api/data` without signing in should return an error with status 401.

**4. Create the first administrator.** Run this once, on a computer that has the repository, in a normal PowerShell window:

```powershell
$env:DATABASE_URL = '<the production connection string from Vercel>'
$env:BETTER_AUTH_SECRET = '<the same value you put in Vercel>'
$env:BETTER_AUTH_URL = 'https://facilities-safety-desk.vercel.app'
$env:FSA_ALLOW_ADMIN_BOOTSTRAP = '1'
$env:FSA_ADMIN_NAME = '<your name>'
$env:FSA_ADMIN_EMAIL = '<your email>'
$env:FSA_ADMIN_PASSWORD = '<at least 15 characters>'
npm ci
npm run auth:bootstrap-admin
```

It prints "First administrator created" and no credentials. It refuses to run without `FSA_ALLOW_ADMIN_BOOTSTRAP`, and it refuses if an active administrator already exists. Close the PowerShell window afterwards so the values are gone.

**5. Create the team's accounts.** Sign in, open **Team access**, and add each person with a role and an initial password of at least 15 characters. No email is sent. Give each person their password privately. They can change it under **My account**.

**6. Optional: authenticator app.** Each person can turn on MFA under **My account** and should save their backup codes.

## What happens to existing data

The 150 sample records and any reports already in the database have no owner. Administrators see all of them. An employee sees only the reports they submit after signing in.

## Rolling back

In Vercel, open Deployments, pick the previous deployment and promote it. Or revert the merge commit on GitHub.

The new tables and columns can stay. The previous version does not read them, and its storage tests pass against a database that has all six migrations applied. An actual rollback on the hosted site has not been rehearsed.

## Previews

A preview deployment builds and shows the sign-in page. Signing in on a preview works only when that preview's `BETTER_AUTH_URL` is its own exact `https://` address and its database has an administrator. Requests that change data are refused when the browser's address differs from `BETTER_AUTH_URL`.

## Checked and not checked

Checked on a development computer on November 5, 2026, against local PostgreSQL:

- All six migrations apply to a fresh database, and apply again without changes.
- The settings check stops a production build when a setting is missing, short or not `https`.
- The first-administrator command creates one administrator, stores the password hashed, and refuses a second run.
- The checks listed in the root `README.md`.

Not checked:

- This version has not been deployed to Vercel. Hosted sign-in, MFA, source upload and recovery have not been exercised there.
- `npm run test:hosted` is written for a hosted address and an approved test account. It has not been run.
- Applying migrations 002 to 006 to the real production database.

## Known limits

- If the only administrator loses their password and their MFA codes, there is no self-service recovery. Create a second administrator early.
- Backups are manual: `npm run backup`, described in `docs/READINESS_REVIEW.md`. Nothing is scheduled.
