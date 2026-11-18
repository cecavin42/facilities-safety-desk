# Deploying this version

For the Vercel project owner. Read this before merging the pull request that adds sign-in. Open it in its own browser tab and keep it open; plan about 30 minutes in one sitting for steps 1 to 6.

Everything here is done in the Vercel and GitHub websites and in the app itself. No terminal, Node.js or Git is needed.

## What changes on the live site

- Every page and every data request requires sign-in, except the sign-in page and the one-time recovery-link page. There is no public view.
- Existing records stay. The database changes add tables, columns and indexes; they change or remove no existing data.
- The deployment creates the first administrator from settings you add in step 1.
- Vercel previews ask for sign-in. By default a preview cannot sign in, because it shares the live database; the optional setup under "Previews that can sign in" gives each preview its own copy of the database, and then previews work the way the instructor showed, this pull request's included.

## Before merging

**0. Optional, two minutes: a database snapshot.** In Vercel open **Storage**, open the Neon database and choose **Open in Neon**. Under **Branches**, create a branch named `before-sign-in`. It is a copy of the live database as it is now. Neon's free plan also keeps a short restore window on its own.

**1. Add five settings in Vercel, for Production only.**

1. Open the Vercel project, then **Settings → Environment Variables**.
2. Add the settings below one at a time. In the form, make sure only **Production** is ticked (not Preview, not Development). An extra tick does no harm, but keep it to Production. Skip the **Redeploy** button Vercel may offer after saving; the merge starts the deployment.
3. Save. The values apply to the next deployment, which is the one the merge starts.

| Setting | Value | Afterwards |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | A random string of at least 32 characters. Any characters are fine. A password generator set to 48 characters works. | Keep it, and keep a private copy |
| `BETTER_AUTH_URL` | The exact address of the live site: `https://facilities-safety-desk.vercel.app`, with nothing after `.app`. The build refuses any other host. | Keep it |
| `FSA_ADMIN_NAME` | Your name | Remove after step 4 |
| `FSA_ADMIN_EMAIL` | Your email address. You sign in with it | Remove after step 4 |
| `FSA_ADMIN_PASSWORD` | A password of 15 to 128 characters. Save it in your password manager now; Vercel will not show it again, and until a second administrator exists it is the only way in | Remove after step 4 |

`DATABASE_URL` is already set from the shared-storage work. Leave it as it is.

- Keep the private copy of `BETTER_AUTH_SECRET` somewhere safe, for example a password manager. A backup can only be restored with the same value.
- Do not put any of these values in GitHub, Drive or a `NEXT_PUBLIC_` variable.
- Do not add `ASSISTANT_OLLAMA_MODEL`, `AUTH_MFA_ENABLED` or `PREVIEW_DB_SETUP` here. The last one belongs only to the optional preview setup at the end of this guide.
- Node.js: nothing to do. The project pins Node.js 24 in `package.json`, and Vercel follows that setting.

**2. Merge the pull request on GitHub.** First, in Vercel **Deployments**, note the deployment marked **Production** and **Current**: that is the one Instant Rollback would return to. Then merge with the green **Merge pull request** button, using the default option, "Create a merge commit". Merge nothing else first. If GitHub shows a conflict on this pull request, do not use **Resolve conflicts**; tell Forrest. After the merge, GitHub offers **Delete branch**: skip it, because the links in the pull request point at the branch (this guide is also on `master` from now on, at `docs/DEPLOYMENT.md`). Do steps 3 to 6 right after, because from the merge on the live site asks everyone to sign in.

## What the production build does

The build command in `vercel.json` runs four steps in order:

1. `npm run check:deploy` checks the settings before anything else happens. The build stops here, nothing in the database changes, and Vercel keeps serving the previous deployment, in any of these cases:
   - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` or `DATABASE_URL` is missing; the secret is shorter than 32 characters; the address does not start with `https://` or is not the project's production address.
   - The three administrator settings are incomplete, the email is not an email address, or the password is not 15 to 128 characters.
   - No administrator exists yet and the three administrator settings are absent. This stops the site from going live with nobody able to sign in.
   - A setting for AI-written answers is malformed, or a setting whose name starts with `NEXT_PUBLIC_` holds a Claude key (see "AI-written answers").
   Once an administrator exists, leftover administrator settings are ignored and never block a deployment.
2. `npm run db:setup` applies the migrations that have not run yet and loads the two bundled source documents. It is safe to run again: existing reports, statuses and question logs are kept. All pending migrations run in one transaction, so a failure leaves the database as it was. If it fails, the log names the migration file and the database error. On a preview build this step is skipped unless the preview has its own database (see the end of this guide).
3. `npm run auth:bootstrap-admin -- --build` creates the first administrator from the three `FSA_ADMIN_` settings when no administrator exists yet. Otherwise it does nothing. Skipped on a preview build unless the preview has its own database.
4. `npm run build` builds the app.

| Migration | Adds |
| --- | --- |
| `001_shared_storage` | Already applied in production. Unchanged. |
| `002_better_auth` | Tables for users, sessions, accounts, verification and rate limits |
| `003_access_controls` | An owner column on reports and questions, an audit log, sign-in attempt limits, and an index |
| `004_two_factor` | A table and a column for authenticator (MFA) data. The table stays empty and the column stays `false` while MFA is switched off |
| `005_recovery_and_sources` | Recovery links and source document versions |
| `006_session_mfa_assurance` | A flag on each session recording that MFA was completed. It stays `false` while MFA is switched off |
| `007_retire_ut_reference_documents` | Adds nothing. It retires the three University of Tennessee reference documents, so they can no longer support an answer. Nothing is deleted: an administrator still sees them in the Source library as retired |
| `008_question_log_model_usage` | Five columns on the question log: whether the answer shown was written by the model, which model, how the attempt ended, and the tokens in and out. They stay empty while AI-written answers are off |

## After the merge

**3. Confirm the deployment worked.**

- In Vercel, **Deployments** should show the new production deployment as Ready.
- Click that deployment and open its build log. It should contain the line `First administrator created.`
- Opening https://facilities-safety-desk.vercel.app should show the sign-in page.

If the deployment shows Error instead, the previous version of the site stays live. Open the build log and look for one of these lines:

| Line in the build log | What it means | What to do |
| --- | --- | --- |
| `Production build stopped.` | A setting is missing or malformed. The line below it says which. Nothing in the database changed. | Fix it under **Settings → Environment Variables**, then choose **Redeploy** on that deployment. Do not press Redeploy while a build is still running. |
| `Database setup failed` | The build could not reach or update the database. The line names the migration and the error. Nothing was left half-applied. | Tell the developer. Do not change `DATABASE_URL`. |
| `Administrator bootstrap did not complete.` | The database changes were applied, but the administrator could not be created, for example because the email address is already in use. | Tell the developer. |

**4. Sign in, create a second administrator, then remove the three administrator settings.**

- Sign in on the live site with the email and password you entered as `FSA_ADMIN_EMAIL` and `FSA_ADMIN_PASSWORD`. Your account is a Safety manager / admin.
- In the left menu open **Team access** and create a second Safety manager / admin account right away (for example a teammate), so that one lost password cannot lock the team out. There is no self-service password reset; a lost password needs a recovery link from another administrator.
- Then, in Vercel, remove `FSA_ADMIN_NAME`, `FSA_ADMIN_EMAIL` and `FSA_ADMIN_PASSWORD`. They are no longer used, and while they remain the password is readable in your Vercel settings.

If the deployment is Ready but you cannot sign in:

- The page says "Unable to sign in": check the email and password against what you entered in Vercel. If they are right, check that `BETTER_AUTH_URL` is exactly the address of the live site, correct it, and choose **Redeploy**.
- The page says "Too many attempts": the account is locked for 15 minutes after more than ten failed tries. Wait, or sign in as the second administrator.
- The page says "Sign-in is not available": something is wrong on the server. Roll back (see "Rolling back") and tell the developer. On a preview without its own database this message is normal; see "Previews that can sign in".

**5. Create the team's accounts.** In **Team access**, add each person with their name, email, a role (Employee or Safety manager / admin) and an initial password of at least 15 characters. The form suggests the role from the email address (Lipscomb addresses as Safety manager / admin, others as Employee); change it if needed. No email is sent, so give each person their password privately. They can change it under **My account**.

- If the app answers "Sign out and sign in again before changing account access", do that. Changes to accounts need a sign-in from the last 15 minutes.
- For testing, QA needs one account of each role.

**6. Remove the old deployments that have no sign-in.** Every deployment made before this version still runs the old code against the live database, so its address keeps showing every record to anyone who has it. In **Deployments**, open the menu (⋮) on each pre-merge preview or branch deployment and choose **Delete**. Keep the previous production deployment until you no longer need Instant Rollback, then delete it too.

**7. Tell the team three things.**

- The site now needs sign-in, and each person gets a password from you.
- Previews ask for sign-in. Until the optional preview setup is done, a preview cannot sign in; see "Previews that can sign in".
- Every open branch and every open pull request must be updated from `master` and pushed again, because this version changes and moves files across the app. Each author can ask their coding assistant to bring in the latest `master`.

**8. Authenticator app (MFA): nothing to do.** It is built but switched off in this version. The option does not appear and it cannot be turned on from the app.

## What happens to existing data

The 150 sample records and any reports already in the database have no owner. Administrators see all of them. An employee sees only the reports they submit after signing in. The two test records (R-1, R-2) and test questions entered on the November 5 preview are still in the live database; an administrator can leave them or change their status.

## Rolling back

In Vercel, open **Deployments**, find the row marked **Production** just below the current one, open its menu (⋮) and choose **Instant Rollback**. Pick a Production row, not a Preview row: if the menu offers **Promote to Production**, you are on a preview. Do not use GitHub's **Revert** button; it failed in class on November 5 and it is not needed.

- On Vercel's free plan this is offered only for the deployment right before the current one. If you need to roll back, do it before merging any other pull request.
- A rollback does not touch the database. The new tables, your administrator account and the team's accounts all stay. The previous version does not read them, and its storage tests pass against a database that has all six migrations applied.
- Leave the two settings you kept in place.
- While rolled back, the site is the old version: no sign-in, and all records are visible to anyone with the address.
- After a rollback, Vercel stops putting new merges live on its own. Check the fix on its preview or on a computer before merging it. When its deployment shows Ready, open that deployment's menu (⋮) under **Deployments** and choose **Promote**; the project's **Overview** page offers the same under the production deployment. The accounts created earlier work again. Do not repeat steps 1 to 4.

This was rehearsed on a separate Vercel test project on November 5. The sign-in version was rolled back to the version without sign-in in a few seconds. That older version worked against the database that already had the new tables. After the rollback was undone, the accounts were still there and sign-in worked. It has not been rehearsed on the team's project.

## Previews that can sign in

**Default:** a preview shows the sign-in page, and a sign-in attempt answers "Sign-in is not available". That is deliberate: a preview shares the live database, and unreviewed code must never accept live passwords or change live data. Check such a pull request on a computer, or merge it and check the live site with Instant Rollback ready.

**Optional setup, about ten minutes, recommended.** It gives every preview its own copy of the database, the staging setup the instructor described in class. Afterwards a preview of any pull request, this one included, can be opened from **Deployments** and clicked through.

1. In Vercel open **Storage**, open the Neon database, and under **Create database branch for deployment** select **Preview**. Neon then makes a copy of the database (copy-on-write) for each preview deployment and removes it with the preview. Changes made on a preview stay on its copy.
2. Under **Settings → Environment Variables**, add these for **Preview** only:

| Setting | Value |
| --- | --- |
| `PREVIEW_DB_SETUP` | `1`. Tells a preview build it has a database of its own, so it runs the migrations there and allows sign-in. Never set it while Preview still shares the live database. |
| `BETTER_AUTH_SECRET` | A different random string of at least 32 characters, not the production one. |
| `FSA_ADMIN_NAME`, `FSA_ADMIN_EMAIL`, `FSA_ADMIN_PASSWORD` | A test administrator for previews: any name, an address you choose, a password of 15 to 128 characters. Keep these; they are used only when a preview's copy has no administrator yet (which is the case for this pull request's preview). Share the password with the team privately. |

3. Open a preview and sign in with the test administrator, or with your live-site account (the copy includes the live accounts). If a preview's build stops with `Preview build stopped`, the log says which Preview setting is missing.

Notes:

- If Vercel itself asks you to log in before the preview opens, that is Vercel's Deployment Protection, separate from the app. On the free plan only the project owner can pass it, so to let teammates open previews turn it off under **Settings → Deployment Protection**; the app's own sign-in still protects every page.
- Check that the `DATABASE_URL` row under Environment Variables lists Preview; the Neon connection normally sets it for both environments.
- Neon's free plan limits how many branches exist at once; Vercel removes a preview's branch when the preview is deleted.

Merge one pull request at a time and check the live site before merging the next, because the free plan can only roll back one step.

## AI-written answers

Optional, and off until a key is added. Without the key the assistant answers exactly as before and makes no outside request.

**What it does.** When a question matches passages in the Source library, the app sends the question and up to eight of those passages to Anthropic's Claude API. Claude writes a short answer. The app checks the answer and shows it with the passages it cites, marked "AI-written". If the call fails, or the answer fails a check, the app shows the passages as before and says so.

**To turn it on.** In Vercel, under **Settings → Environment Variables**:

| Setting | Value | Notes |
| --- | --- | --- |
| `ASSISTANT_CLAUDE_API_KEY` | The API key | Tick **Production**. Tick **Preview** as well when a tester should see AI-written answers on a preview before the merge. Choose **Sensitive** so Vercel never shows the value again |
| `ASSISTANT_CLAUDE_BASE_URL` | Only when the key came with an address of its own | Must start with `https://`. Leave it out for a key from the Anthropic console |
| `ASSISTANT_CLAUDE_MODEL` | Optional | The default is `claude-haiku-5-5`, the model the spec names. `claude-opus-5-5` gave fuller answers in the November 15 test and cost about forty times as much per answer (see **Cost**). `claude-sonnet-5-5` is priced at twenty times Haiku and was not measured |

Then redeploy: **Deployments**, the latest one, **Redeploy**. A setting applies from the next deployment. The build log then says `Assistant AI writing: on (model claude-haiku-5-5).`

**To turn it off.** Delete `ASSISTANT_CLAUDE_API_KEY` and redeploy. Nothing else changes.

**Keep the key private.** It belongs in Vercel's settings and nowhere else: not GitHub, not Drive, not a text message. The build stops if a setting whose name starts with `NEXT_PUBLIC_` holds a Claude key, because such a setting is sent to every browser.

**What leaves the site.** For each such question: the question, and for each passage its document title, publisher, revision, page and text. Nothing about the person asking. Passages from documents that are not public are sent too, so the owner of those documents has to agree to that first.

**The checks on every answer.** Each point must cite a passage that was sent. Every number in a point, with the unit it counts, must be in a passage the point cites. So must every quoted phrase, phone number, email address and link. An answer that fails is not shown.

**Cost.** Measured against the real API on November 15, 2026, with 23 test questions of which 17 reached the model, at the prices read on November 3, 2026. A call used about 5,400 tokens in and 360 out.

| Model | Cost per answer | Per 1,000 answers | Typical wait | Slowest |
| --- | --- | --- | --- | --- |
| Claude Haiku 5.5 (the default) | about 0.07 cents | $0.73 | 2.3 seconds | 4.2 seconds |
| Claude Opus 5.5 | about 2.9 cents | $28.76 | 4.0 seconds | 5.7 seconds |

The question log records the tokens of every call, and `npm run eval:claude` reports tokens, cost and time for a set of questions on one or more models. Set a spending cap on the key in the provider's console.

## Checked and not checked

Checked on a development computer on November 12, 2026, for AI-written answers, with a local stand-in for the Claude API in place of a real model (`scripts/claude-stub.ts`; no key and no cost):

- `npm run test:claude`, 25 of 25: the settings, the request, the choice of passages, and every check on an answer. `npm run test:catalog`, 28 of 28, covers the search that chooses the passages.
- `npm run test:claude-path`, 9 of 9, through the app's own sign-in and database: a written answer cites the exact passage and its tokens are logged; a repeated question makes no second call; an invented number, a citation that was never sent and plain prose are each withheld; a refusal, a server fault and a slow reply each fall back to the passages without a retry; declined questions and questions a tested guide answers never reach the model.
- In a browser: the "AI-written" label, the note under it, the cited sources and the line that says AI writing is on.

Checked on a development computer on November 15, 2026, against the real API (`npm run eval:claude`), with 23 private test questions on a copy of the live site's 20 uploaded documents. Sixteen of the questions have an answer in those documents, one has none, and six must never reach the model (declined, or answered by a tested guide):

- Claude Opus 5.5: 23 of 23 as expected. All 16 got a written answer that passed every check.
- Claude Haiku 5.5: 22 of 23. Fifteen of the 16 got a written answer. One reply failed a citation check, so the passages were shown instead.
- On both models the question with no source came back as not answered, and the six never reached the model.
- A question with two parts ("There is a fire. Who do I call, and where do I go?") got both parts on both models.

The wording of the instructions to the model was tightened after the first runs that day: stay on what was asked, cite every passage a point draws on, and remark on a document's date only when documents disagree. The numbers above are from the runs after that change.

Not checked for AI-written answers:

- A Vercel deployment with a key: the function's time limit and loading the Claude library there.
- Claude Sonnet 5.5, and any question outside the 23.

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

Checked on the same Vercel test project on November 8, 2026, after the preview changes:

- Production deployments passed the settings check, kept the database, and over HTTPS signed in, listed the register, answered an assistant question with its citation, and refused sign-in, questions and source uploads sent from a foreign origin. `npm run test:hosted` passed again.
- A preview deployment in own-database mode (`PREVIEW_DB_SETUP=1` plus the Preview settings above, against the test project's database) passed the stricter settings check, ran the database setup without changing existing rows, skipped administrator creation because one existed, and signed in over HTTPS. The real Neon per-preview copy was not exercised; the test project uses one database for both environments.
- Simulated on a computer: a preview build without `PREVIEW_DB_SETUP` reports that sign-in is off and checks nothing; with the flag but missing settings it stops; a production build with a `BETTER_AUTH_URL` whose host differs from the project's production address stops.
- A migration upgrade test by an independent reviewer on a local database built from the current live schema: every existing row byte-identical after the upgrade, a forced failure rolled back cleanly, and the current live code still worked against the upgraded schema.

Not checked:

- This version has not been deployed to the team's Vercel project. The first time it runs there will be the live site.
- Applying migrations 002 to 006 to the real production database.
- Account recovery links and backup and restore have not been exercised on a hosted site.
- Neon's per-preview database branch on a Git-connected project.

## Known limits

- If the only administrator loses their password, there is no self-service recovery. Create a second administrator early (step 4).
- Anyone who knows an email address can lock that account out of sign-in for 15 minutes by failing ten attempts. A second administrator account is the workaround.
- Old deployments keep running the old code until they are deleted (step 6).
- Backups are manual: `npm run backup`, described in `docs/READINESS_REVIEW.md`. Nothing is scheduled.
