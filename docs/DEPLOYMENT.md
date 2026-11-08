# Deploying this version

For the Vercel project owner. Read this before merging the pull request that adds sign-in.

Everything here is done in the Vercel and GitHub websites and in the app itself. No terminal, Node.js or Git is needed.

## What changes on the live site

- Every page and every data request requires sign-in. There is no public view.
- Existing records stay. The database changes only add tables and columns.
- The deployment creates the first administrator from settings you add in step 1.
- Vercel previews of later pull requests ask for sign-in and accept the live-site accounts, so review by preview keeps working. The preview of this pull request itself cannot sign in yet. See "Reviewing pull requests after this one".

## Before merging

**1. Add five settings in Vercel.**

1. Open the Vercel project, then **Settings → Environment Variables**.
2. Add each setting below. For `BETTER_AUTH_SECRET`, leave **Production** and **Preview** ticked and untick **Development**. For the other four, leave **Production** ticked and untick **Preview** and **Development**.
3. Save. The values apply to the next deployment, which is the one the merge starts.

| Setting | Value | Afterwards |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | A random string of at least 32 characters. Any characters are fine. A password generator set to 48 characters works. | Keep it, and keep a private copy |
| `BETTER_AUTH_URL` | The exact address of the live site: `https://facilities-safety-desk.vercel.app`, with nothing after `.app` | Keep it |
| `FSA_ADMIN_NAME` | Your name | Delete after step 4 |
| `FSA_ADMIN_EMAIL` | Your email address. You sign in with it | Delete after step 4 |
| `FSA_ADMIN_PASSWORD` | A password of at least 15 characters | Delete after step 4 |

`DATABASE_URL` is already set from the shared-storage work. Leave it as it is.

- Keep the private copy of `BETTER_AUTH_SECRET` somewhere safe, for example a password manager. A backup can only be restored with the same value.
- Do not put any of these values in GitHub, Drive or a `NEXT_PUBLIC_` variable.
- Do not add `ASSISTANT_OLLAMA_MODEL` or `AUTH_MFA_ENABLED` in Vercel.
- Node.js: nothing to do. The project pins Node.js 24 in `package.json`, and Vercel follows that setting.

**2. Merge the pull request on GitHub** with the green **Merge pull request** button, using the default option, "Create a merge commit". Merge nothing else first. If GitHub shows a conflict on this pull request, do not use **Resolve conflicts**; tell Forrest. Plan to do steps 3 to 6 right after, in one sitting, because from the merge on the live site asks everyone to sign in.

## What the production build does

The build command in `vercel.json` runs four steps in order:

1. `npm run check:deploy` checks the settings before anything else happens. The build stops here, nothing in the database changes, and Vercel keeps serving the previous deployment, in any of these cases:
   - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` or `DATABASE_URL` is missing, the secret is shorter than 32 characters, or the address does not start with `https://`.
   - The three administrator settings are incomplete, the email is not an email address, or the password is shorter than 15 characters.
   - No administrator exists yet and the three administrator settings are absent. This stops the site from going live with nobody able to sign in.
2. `npm run db:setup` applies the migrations that have not run yet and loads the five bundled source documents. It is safe to run again: existing reports, statuses and question logs are kept. On a preview build this step is skipped, so a pull request never changes a database.
3. `npm run auth:bootstrap-admin -- --build` creates the first administrator from the three `FSA_ADMIN_` settings when no administrator exists yet. Otherwise it does nothing. It is skipped on a preview build.
4. `npm run build` builds the app.

Once an administrator exists, the three `FSA_ADMIN_` settings are no longer needed. Deleting them in step 4 is safe for every later build.

| Migration | Adds |
| --- | --- |
| `001_shared_storage` | Already applied in production. Unchanged. |
| `002_better_auth` | Tables for users, sessions, accounts, verification and rate limits |
| `003_access_controls` | An owner column on reports and questions, an audit log, sign-in attempt limits |
| `004_two_factor` | A table and a column for authenticator (MFA) data. The sign-in code reads the column. It stays empty while MFA is switched off |
| `005_recovery_and_sources` | Recovery links and source document versions |
| `006_session_mfa_assurance` | A flag on each session recording that MFA was completed. The sign-in code reads it. It stays off while MFA is switched off |

## After the merge

**3. Confirm the deployment worked.**

- In Vercel, **Deployments** should show the new production deployment as Ready.
- Click that deployment and open its build log. It should contain the line `First administrator created.`
- Opening https://facilities-safety-desk.vercel.app should show the sign-in page.

If the deployment shows Error instead, the previous version of the site stays live. Open the build log and look for one of these lines:

| Line in the build log | What it means | What to do |
| --- | --- | --- |
| `Production build stopped.` | A setting is missing or malformed. The line below it says which. Nothing in the database changed. | Fix it under **Settings → Environment Variables**, then choose **Redeploy** on that deployment. |
| `Database setup failed.` | The build could not reach or update the database. | Tell the developer. Do not change `DATABASE_URL`. |
| `Administrator bootstrap did not complete.` | The database changes were applied, but the administrator could not be created, for example because the email address is already in use. | Tell the developer. |

**4. Sign in, then delete the three administrator settings.**

- Sign in on the live site with the email and password you entered as `FSA_ADMIN_EMAIL` and `FSA_ADMIN_PASSWORD`. Your account is a Safety manager / admin.
- In Vercel, delete `FSA_ADMIN_NAME`, `FSA_ADMIN_EMAIL` and `FSA_ADMIN_PASSWORD`. They are no longer used, and while they remain the password is readable in your Vercel settings.

If the deployment is Ready but you cannot sign in:

- The page says "Unable to sign in": check the email and password against what you entered in Vercel. If they are right, check that `BETTER_AUTH_URL` is exactly the address of the live site, correct it, and choose **Redeploy**.
- The page says "Sign-in is not available": something is wrong on the server. Roll back (see "Rolling back") and tell the developer.

**5. Create the team's accounts.** In the left menu open **Team access**. Add each person with their name, email, a role (Employee or Safety manager / admin) and an initial password of at least 15 characters. The form suggests the role from the email address (Lipscomb addresses as Safety manager / admin, others as Employee); change it if needed. No email is sent, so give each person their password privately. They can change it under **My account**.

- If the app answers "Sign out and sign in again before changing account access", do that. Changes to accounts need a sign-in from the last 15 minutes.
- Create a second Safety manager / admin account early, so that one lost password cannot lock the team out.
- For testing, QA needs one account of each role.

**6. Tell the team three things.**

- The site now needs sign-in, and each person gets a password from you.
- Vercel previews now ask for sign-in. Use your live-site account.
- Every open branch and every open pull request must be updated from `master` and pushed again, because this version changes and moves files across the app. Each author can ask their coding assistant to bring in the latest `master`.

**7. Authenticator app (MFA): nothing to do.** It is built but switched off in this version. The option does not appear and it cannot be turned on from the app.

## What happens to existing data

The 150 sample records and any reports already in the database have no owner. Administrators see all of them. An employee sees only the reports they submit after signing in.

## Rolling back

In Vercel, open **Deployments**, open the menu (⋮) on the previous production deployment and choose **Instant Rollback**.

- On Vercel's free plan this is offered only for the deployment right before the current one. If you need to roll back, do it before merging any other pull request.
- A rollback does not touch the database. The new tables, your administrator account and the team's accounts all stay. The previous version does not read them, and its storage tests pass against a database that has all six migrations applied.
- Leave the two settings you kept in place.
- While rolled back, the site is the old version: no sign-in, and all records are visible to anyone with the address.
- After a rollback, Vercel stops putting new merges live on its own. Check the fix on its preview or on a computer before merging it. When its deployment shows Ready, open that deployment's menu (⋮) under **Deployments** and choose **Promote to Production**. (**Undo Rollback** on the project's **Overview** page does the same.) The accounts created earlier work again. Do not repeat steps 1 to 4.

This was rehearsed on a separate Vercel test project on November 5. The sign-in version was rolled back to the version without sign-in in a few seconds. That older version worked against the database that already had the new tables. After the rollback was undone, the accounts were still there and sign-in worked. It has not been rehearsed on the team's project.

## Reviewing pull requests after this one

A preview of a later pull request works the way the instructor showed: open it from **Deployments** and click around. It asks for sign-in; use the same email and password as on the live site, because previews use the live site's database. This works because `BETTER_AUTH_SECRET` is set for Preview (step 1) and a preview works out its own address from Vercel. If Vercel itself asks you to log in before the preview opens, that is Vercel's Deployment Protection, separate from the app; the app's sign-in comes after it.

Two limits:

- The preview of this pull request itself shows "Sign-in is not available", because the database tables it needs are created by the production deployment at the merge. Check this one on a computer, or on the live site after merging with rollback ready.
- A preview build never runs migrations, but a signed-in preview reads and writes the live database: anything you create or change there is real. Use a preview to look and click; do not test deletions or account changes on one. A pull request that adds a database change (a new migration) cannot be fully checked on its preview; its author says so in the pull request, and QA checks it on a computer.

Merge one pull request at a time and check the live site before merging the next, because the free plan can only roll back one step.

## Checked and not checked

Checked on a development computer on November 5, 2026, against local PostgreSQL:

- All six migrations apply to a fresh database, and apply again without changes.
- The settings check stops a production build, before any database change, in each case listed under "What the production build does". With no administrator and no administrator settings, the database had no tables after the stopped build.
- The build step creates one administrator on an empty database, stores the password hashed, and does nothing on a second run. That administrator can sign in and sees the 150 sample records. A later build with the three settings deleted passes.
- A preview build with no settings and no database: it builds, shows the sign-in page, refuses data requests, connects to no database and creates no administrator.
- The checks listed in the root `README.md`.

Checked on a separate Vercel test project on November 5, 2026 (free plan, Node.js 24, its own Neon database connected to both Production and Preview):

- A production deployment with no settings stopped at the settings check. With the database connected but no administrator settings it stopped again, and the database still had no tables.
- With the five settings it deployed in under a minute, the build log said `First administrator created.`, and that account signed in. `npm run test:hosted` passed against it.
- Over HTTPS on that site: the register with the 150 sample records, a new report, both assistant questions from the pull request, the source library, a text upload and a PDF upload, and an Employee account that saw only its own reports and no Team access.
- After the three administrator settings were deleted, the next deployment passed and sign-in still worked.
- A preview deployment skipped the database step and created no administrator. Row counts in the shared database were identical before and after. The preview showed the sign-in page and refused a sign-in attempt.
- Instant Rollback, as described under "Rolling back". After a rollback, a new production deployment stayed off the live address until it was promoted.
- The first hosted run found a fault that no local check could: every assistant question returned a server error, because the PDF library did not load on Vercel. That is fixed in this version and was re-tested there.

Checked on the same Vercel test project on November 8, 2026, after previews learned to sign in:

- A production deployment passed the settings check, kept the database, and signed in, listed the register and answered an assistant question with its citation over HTTPS.
- A preview deployment, with `BETTER_AUTH_SECRET` set for Preview and no `BETTER_AUTH_URL` for Preview, skipped database setup during its build, then signed in with the live-site account, listed the register and answered an assistant question. Sign-in, questions and source uploads sent from a foreign origin were refused (403) on both the preview and production.

Not checked:

- This version has not been deployed to the team's Vercel project. The first time it runs there will be the live site.
- Applying migrations 002 to 006 to the real production database.
- Account recovery links and backup and restore have not been exercised on a hosted site.

## Known limits

- If the only administrator loses their password, there is no self-service recovery. Create a second administrator early (step 5).
- The preview of a pull request that adds a database change cannot be fully checked on the preview. See "Reviewing pull requests after this one".
- Backups are manual: `npm run backup`, described in `docs/READINESS_REVIEW.md`. Nothing is scheduled.
