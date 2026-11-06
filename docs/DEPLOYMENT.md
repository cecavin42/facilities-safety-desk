# Deploying this version

For the Vercel project owner. Read this before merging the pull request that adds sign-in.

Everything in steps 1 to 7 is done in the Vercel and GitHub websites and in the app itself. No terminal, Node.js or Git is needed.

## What changes on the live site

- Every page and every data request requires sign-in. There is no public view.
- Existing records stay. The database changes only add tables and columns.
- The deployment creates the first administrator from settings you add in step 1. Until an administrator exists, nobody can sign in.
- Vercel previews stop at the sign-in page from this version on. See "Reviewing pull requests after this one".

## Before merging

**1. Add five settings in Vercel.**

1. Open the Vercel project, then **Settings → Environment Variables**.
2. Add each setting below. Tick **Production** only.
3. Save. The values apply to the next deployment, which is the one the merge starts.

| Setting | Value | Afterwards |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | A random string of at least 32 letters and digits. A password generator set to 48 characters works. | Keep it, and keep a private copy |
| `BETTER_AUTH_URL` | The exact address of the live site: `https://facilities-safety-desk.vercel.app`, with nothing after `.app` | Keep it |
| `FSA_ADMIN_NAME` | Your name | Delete after step 4 |
| `FSA_ADMIN_EMAIL` | Your email address. You sign in with it | Delete after step 4 |
| `FSA_ADMIN_PASSWORD` | A password of at least 15 characters | Delete after step 4 |

`DATABASE_URL` is already set from the shared-storage work. Leave it as it is.

- Keep the private copy of `BETTER_AUTH_SECRET` somewhere safe, for example a password manager. A backup can only be restored with the same value.
- Do not put any of these values in GitHub, Drive or a `NEXT_PUBLIC_` variable.
- Do not add `ASSISTANT_OLLAMA_MODEL` or `AUTH_MFA_ENABLED` in Vercel.

**2. Merge the pull request on GitHub** with the green **Merge pull request** button, using the default option, "Create a merge commit". Plan to do steps 3 to 6 right after, in one sitting, because from the merge on the live site asks everyone to sign in.

## What the production build does

The build command in `vercel.json` runs four steps in order:

1. `npm run check:deploy` confirms the settings exist and are well formed: the two you keep, the three administrator settings, and `DATABASE_URL`. If something is missing or malformed, the build stops here, nothing in the database changes, and Vercel keeps serving the previous deployment.
2. `npm run db:setup` applies the migrations that have not run yet and loads the five bundled source documents. It is safe to run again: existing reports, statuses and question logs are kept. On a preview build this step is skipped, so a pull request never changes a database.
3. `npm run auth:bootstrap-admin -- --build` creates the first administrator from the three `FSA_ADMIN_` settings when no administrator exists yet. When one exists, or the settings are absent, it does nothing. It is skipped on a preview build.
4. `npm run build` builds the app.

| Migration | Adds |
| --- | --- |
| `001_shared_storage` | Already applied in production. Unchanged. |
| `002_better_auth` | Tables for users, sessions, accounts, verification and rate limits |
| `003_access_controls` | An owner column on reports and questions, an audit log, sign-in attempt limits |
| `004_two_factor` | Authenticator (MFA) data. Unused while MFA is switched off |
| `005_recovery_and_sources` | Recovery links and source document versions |
| `006_session_mfa_assurance` | A flag on each session recording that MFA was completed. Unused while MFA is switched off |

## After the merge

**3. Confirm the deployment worked.**

- In Vercel, **Deployments** should show the new production deployment as Ready.
- Its build log should contain the line `First administrator created.`
- If it shows Error instead, open its build log. The line "Production build stopped" lists the setting that is missing or malformed. Fix it under **Settings → Environment Variables**, then choose **Redeploy** on that deployment. The previous version of the site stays live in the meantime.
- Opening https://facilities-safety-desk.vercel.app should show the sign-in page.

**4. Sign in, then delete the three administrator settings.**

- Sign in on the live site with the email and password you entered as `FSA_ADMIN_EMAIL` and `FSA_ADMIN_PASSWORD`. Your account is a Safety manager / admin.
- In Vercel, delete `FSA_ADMIN_NAME`, `FSA_ADMIN_EMAIL` and `FSA_ADMIN_PASSWORD`. They are no longer used, and while they remain the password is readable in your Vercel settings.
- If sign-in fails, look at the build log. `No first-administrator settings found` means the three settings were not saved for Production. Add them and choose **Redeploy**.

**5. Create the team's accounts.** In the left menu open **Team access**. Add each person with their name, email, a role (Employee or Safety manager / admin) and an initial password of at least 15 characters. No email is sent, so give each person their password privately. They can change it under **My account**.

- Create a second Safety manager / admin account early, so that one lost password cannot lock the team out.
- For testing, QA needs one account of each role.

**6. Tell the team.** The site now needs sign-in. Anyone with an open branch must update it from `master` before opening a pull request, because this version changes and removes files across the app.

**7. Authenticator app (MFA): nothing to do.** It is built but switched off in this version. The option does not appear and it cannot be turned on from the app.

## What happens to existing data

The 150 sample records and any reports already in the database have no owner. Administrators see all of them. An employee sees only the reports they submit after signing in.

## Rolling back

In Vercel, open **Deployments**, open the menu (⋮) on the previous production deployment and choose **Instant Rollback**.

- On Vercel's free plan this is offered only for the deployment right before the current one. If you need to roll back, do it before merging any other pull request.
- A rollback does not touch the database. The new tables, your administrator account and the team's accounts all stay. The previous version does not read them, and its storage tests pass against a database that has all six migrations applied.
- Leave the two settings you kept in place.
- After a rollback, Vercel stops putting new merges live on its own. When a fix has been merged and its deployment shows Ready, open the project's **Overview** page, choose **Undo Rollback** on the production deployment, pick the new deployment and confirm. The accounts created earlier work again. Do not repeat steps 1 to 4.

An actual rollback on the hosted site has not been rehearsed.

## Reviewing pull requests after this one

Until now a reviewer could open the Vercel preview of a pull request and click around. From this version on, every preview stops at the sign-in page, and a sign-in attempt answers that the service is unavailable. A preview has no sign-in settings and a different address from the live site. This applies to every later pull request, not only to the one that adds sign-in.

Until sign-in on previews is built, which is planned as its own pull request, there are two ways to check a change:

- Run it on a computer with `npm run auth:local` (see the root `README.md`). This is the route for QA.
- Merge it, check the live site, and use Instant Rollback if something is wrong.

A preview build never changes a database. A Preview that has its own database can run the database step by adding `PREVIEW_DB_SETUP=1` for Preview. To see whether Preview has its own database, for a database connected through Vercel's Storage tab (Neon), open **Storage**, then the database, then **Projects**, and look for the option Neon's guide calls **Create database branch for deployment** with **Preview** selected. If it is not selected, previews and production share one database; leave `PREVIEW_DB_SETUP` unset. Neon's guide: https://neon.com/docs/guides/vercel-managed-integration

## Creating the administrator from a computer instead

This is an alternative to the three `FSA_ADMIN_` settings, for someone who prefers not to put a password in Vercel. Leave those three settings out in step 1, and after step 3 run the following. It needs Node.js 24, Git and a copy of the repository.

Open a normal PowerShell window (not "Run as administrator") in the copy of the repository:

```powershell
git checkout master
git pull
$env:DATABASE_URL = '<the production connection string from Vercel>'
$env:BETTER_AUTH_SECRET = '<the same value you put in Vercel>'
$env:BETTER_AUTH_URL = 'https://facilities-safety-desk.vercel.app'
$env:FSA_ALLOW_ADMIN_BOOTSTRAP = '1'
$env:FSA_ADMIN_NAME = '<your name>'
$env:FSA_ADMIN_EMAIL = '<your email>'
$env:FSA_ADMIN_PASSWORD = '<at least 15 characters, no quote marks>'
npm ci
npm run auth:bootstrap-admin
```

- Success looks like: `First administrator created. No credentials were printed.`
- `Administrator bootstrap did not complete` means a value is missing, the password is shorter than 15 characters, or an administrator already exists. The command refuses to create a second one.
- Close the PowerShell window afterwards so the values are gone.

## Checked and not checked

Checked on a development computer on November 5, 2026, against local PostgreSQL:

- All six migrations apply to a fresh database, and apply again without changes.
- The settings check stops a production build when a setting is missing, short or not `https`, and when the administrator settings are incomplete or the password is too short.
- The build step creates one administrator on an empty database, stores the password hashed, and does nothing on a second run. That administrator can sign in and sees the 150 sample records.
- The command run by hand refuses to create a second administrator.
- A preview build with no settings and no database: it builds, shows the sign-in page, refuses data requests, connects to no database and creates no administrator.
- The checks listed in the root `README.md`.

Not checked:

- This version has not been deployed to Vercel. Hosted sign-in, source upload and recovery have not been exercised there.
- `npm run test:hosted` is written for a hosted address and an approved test account. It has not been run.
- Applying migrations 002 to 006 to the real production database.

## Known limits

- If the only administrator loses their password, there is no self-service recovery. Create a second administrator early (step 5).
- Vercel previews cannot be signed in to. See "Reviewing pull requests after this one".
- Backups are manual: `npm run backup`, described in `docs/READINESS_REVIEW.md`. Nothing is scheduled.
