# Deploying this version

For the Vercel project owner. Read this before merging the pull request that adds sign-in.

## What changes on the live site

- Every page and every data request requires sign-in. There is no public view.
- Existing records stay. The database changes only add tables and columns.
- Nobody can sign in until the first administrator is created (step 4). That is a one-time command.

## Before merging

**1. Add two settings in Vercel.**

1. Open the Vercel project, then **Settings → Environment Variables**.
2. Add each setting below. Tick **Production** only.
3. Save. The values apply to the next deployment, which is the one the merge starts.

| Setting | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | A random string of at least 32 characters. To generate one, run this in a terminal and copy the output: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `BETTER_AUTH_URL` | `https://facilities-safety-desk.vercel.app` with nothing after `.app`. |

`DATABASE_URL` is already set from the shared-storage work. Leave it as it is.

- Keep a private copy of `BETTER_AUTH_SECRET`, for example in a password manager. You need it again in step 4, and a backup can only be restored with the same value.
- Do not put either value in GitHub, Drive or a `NEXT_PUBLIC_` variable.
- Do not set `ASSISTANT_OLLAMA_MODEL` on Vercel.

**2. Check which database Preview deployments use.** Every build runs `npm run db:setup`, and that includes the preview build of each pull request. So this pull request's preview build has already applied migrations 002 to 006 to whatever database Preview points at. If that is the production database, the new tables are already there. They do no harm: the current site does not read them.

To see which it is, for a database connected through Vercel's Storage tab (Neon):

1. In Vercel, open **Storage**, then the database, then **Projects**.
2. Look at how this project is connected. Neon's guide names the option **Create database branch for deployment** with a **Preview** choice. When Preview is selected, each preview gets its own branch named `preview/<git-branch>` and never touches production data.
3. If Preview is not selected, previews and production share one database. Tell the team before the next pull request is opened, so nobody tests against production data by accident.

Neon's guide describes choosing this when the project is first connected. It does not say how to change it on an existing connection, so check their guide before changing anything: https://neon.com/docs/guides/vercel-managed-integration

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

**3. Confirm the deployment worked and the site asks for sign-in.**

- In Vercel, **Deployments** should show the new production deployment as Ready.
- If it shows Error instead, open its build log. The line "Production build stopped" lists the setting that is missing or malformed. Fix it under **Settings → Environment Variables**, then choose **Redeploy** on that deployment. The previous version of the site stays live in the meantime.
- Opening https://facilities-safety-desk.vercel.app should show the sign-in page.
- Opening https://facilities-safety-desk.vercel.app/api/data without signing in should show the message "Sign in to continue."

**4. Create the first administrator.** Do this once.

You need Node.js 24 and Git on your computer. You also need the production database connection string: in Vercel, **Settings → Environment Variables**, find `DATABASE_URL` for Production and reveal its value.

Open a normal PowerShell window (not "Run as administrator") in your copy of the repository and get the merged code:

```powershell
git checkout master
git pull
```

Then run the following, replacing each `<...>` with your value. Keep the single quotes.

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

- Success looks like: `First administrator created. No credentials were printed.`
- If it prints `Administrator bootstrap did not complete`, check that every value above is filled in, that the password has at least 15 characters, and that no administrator exists yet. The command refuses to create a second one.
- Close the PowerShell window afterwards so the values are gone.

Then open the site and sign in with that email and password.

**5. Create the team's accounts.** In the left menu open **Team access**. Add each person with their name, email, a role (Employee or Safety manager / admin) and an initial password of at least 15 characters. No email is sent, so give each person their password privately. They can change it under **My account**.

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
