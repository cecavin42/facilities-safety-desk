# Facilities Safety Desk

Team A's class project for MSAI 5563 AI Studio I. A facilities department uses it to report incidents and near misses, review them, and look up safety rules with citations. All data in the app is fictional.

Production: https://facilities-safety-desk.vercel.app

## What the app does

| Area | What it does |
| --- | --- |
| Sign-in | Email and password for approved accounts only. No public sign-up. An authenticator app option (MFA) is built but switched off in this version. |
| New report | A guided incident form with the validation rules from `docs/spec.md`. |
| Incident register | Search, filter, export to CSV, and change a report's status. |
| Safety insights | Charts and tables over the reports, plus assistant question statistics. |
| Import incidents | CSV upload with a preview, row-level errors and duplicate detection. |
| Source library | The documents the assistant may cite. Administrators upload, activate and retire versions. |
| Safety assistant | Answers from the active sources only, with the passage and citation shown. |
| Team access | Administrators create accounts, change roles, disable accounts and issue recovery links. |

## Roles

| Capability | Employee | Safety manager / admin |
| --- | --- | --- |
| Sign in, change own password | Yes | Yes |
| Submit a report and use the assistant | Yes | Yes |
| Read and export reports | Own reports only | All reports |
| Change a report's status | No | Yes |
| Import CSV, view insights and question statistics | No | Yes |
| Manage sources and accounts, view the audit log | No | Yes |

MFA is switched off. The option does not appear, and it cannot be turned on from the app. It stays off as long as the setting `AUTH_MFA_ENABLED` is not added, and the deployment guide says not to add it. Plain sign-in comes first, as discussed in class on November 5.

The server enforces these rules on every request. The role names follow the team survey and still need team agreement.

## Run it on your computer

You need Git and Node.js 24, the version this was verified on. Type the commands in any terminal: PowerShell on Windows, Terminal on a Mac. On Windows, use a normal terminal, not "Run as administrator": PostgreSQL refuses to start under an administrator account.

The first time, get a copy of the repository:

```powershell
git clone https://github.com/cecavin42/facilities-safety-desk.git
cd facilities-safety-desk
```

Then, inside that folder:

```powershell
npm ci
npm run auth:local
```

To run a pull request that is not merged yet, run `git checkout <its branch name>` before `npm ci`.

Then open http://127.0.0.1:3103.

The launcher starts its own PostgreSQL on port 54331, applies the migrations, loads 150 fictional records and five source documents, creates three fictional accounts, builds the app and starts it. Ctrl+C stops it and keeps the data.

- The generated sign-in details are in the file `review-accounts.json`, in the `.local` folder inside the repository folder. Open it with any text editor. It lists one Safety manager / admin account and two Employee accounts.
- The local settings are in `.env.local`.
- Both are ignored by Git, along with `.test-db/`. Do not share or commit them.

## Checks

These need nothing running:

| Command | What it covers | Result on this version |
| --- | --- | --- |
| `npm run lint` | ESLint | Pass |
| `npx tsc --noEmit` | TypeScript | Pass |
| `npm run build` | Production build | Pass |
| `npm run test:app` | Form rules, CSV, record handling | 19 of 19 |
| `npm run test:assistant` | Assistant answers and citations | 40 of 40 |
| `npm run test:catalog` | Source catalog and frozen challenge cases | 23 of 23 |
| `npm run test:auth-config` | Sign-in configuration fails closed | 1 of 1 |
| `npm run test:client` | Browser API client | 1 of 1 |
| `npm run test:db` | Storage: migrations, concurrent writes, retries, rollback | 5 of 5 |
| `npm run eval:assistant` | 31 development questions, answered by the assistant code directly | 31 of 31 (the earlier search passed 14) |

These need `npm run auth:local` running in another terminal. Run them one at a time:

| Command | What it covers | Result on this version |
| --- | --- | --- |
| `npm run test:access` | Sign-in, roles, ownership, cross-site requests, audit, MFA off by default | 24 of 24 |
| `npm run test:mfa` | Authenticator enrollment, backup codes, recovery links. Needs the app started with `AUTH_MFA_ENABLED=1` | 7 of 7 |
| `npm run test:sources` | Upload, activate and retire source versions | 6 of 6 |
| `npm run test:concurrency` | Simultaneous saves and status changes | Pass |
| `npm run test:restore` | Encrypted backup restored into an empty database | Pass |

Results are from one run on November 5, 2026, on Windows with Node.js 24.13. The assistant cases were written during development, so they are not an independent accuracy estimate.

## Deploying

The Vercel project owner follows [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). It lists the settings to add in Vercel, how the deployment creates the first administrator, what happens to existing data, and how to roll back. None of it needs a terminal.

## Reviewing a pull request

From this version on, the Vercel preview of a pull request stops at the sign-in page, so it can no longer be used to click through a change. That applies to every later pull request. Until sign-in on previews is built, a workable routine is:

1. QA, or anyone with Git and Node.js, runs the pull request on a computer, as described under "Run it on your computer", and reports the result to the team.
2. The Vercel owner merges it and checks the live site.
3. If something is wrong, the owner rolls back in Vercel. `docs/DEPLOYMENT.md` says how.

Merge one pull request at a time and check it before merging the next. Vercel's free plan can only roll back one step.

## The assistant and AI models

On Vercel the assistant uses no AI model. It matches the question to the active sources and answers from prepared, cited guidance. An optional local model can help interpret questions when the app runs on a computer that has Ollama and the setting `ASSISTANT_OLLAMA_MODEL`. Leave that setting off on Vercel, because the model address is local.

## Documentation

| File | Contents |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Settings, first administrator, checks after deploy, rollback |
| [docs/README.md](docs/README.md) | How the team works: roles, branch workflow, links |
| [docs/spec.md](docs/spec.md) | The specification |
| [docs/AUTH_REVIEW.md](docs/AUTH_REVIEW.md) | Sign-in and access rules in detail |
| [docs/READINESS_REVIEW.md](docs/READINESS_REVIEW.md) | MFA, recovery, source library, backup and restore |
| [docs/ASSISTANT_REVIEW.md](docs/ASSISTANT_REVIEW.md) | How the assistant answers and how it was evaluated |
| [docs/APP_REVIEW.md](docs/APP_REVIEW.md) | Form, register, import and insights workflows |
| [docs/DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md) | Visual design and asset credits |
| [docs/live-test-report-2026-11-04.md](docs/live-test-report-2026-11-04.md) | Kai's manual test of the earlier production version |

The five review files were written on November 3 for separate draft pull requests. Each has a note at the top saying so.

## Not included

- University single sign-on, and email for invitations or password resets. An administrator shares an initial password or a recovery link privately.
- A hosted AI model.
- Sign-in on Vercel previews.
- An automatic consistency check on uploaded source documents, which the instructor suggested on November 5. For now an upload stays a draft until an administrator has reviewed and activated it, and a file that is already a version of the same source is refused.
- MFA for users. The code is present but switched off.
- Scheduled or off-site backups. `npm run backup` is a manual tool.
- Hazardous-materials content and a staff directory, which the instructor asked about on October 29.
- Real Lipscomb policies. The sources are federal, Tennessee and UT Knoxville reference documents.

## Credits

Implementation was AI-assisted (OpenAI Codex and Claude Code) at Forrest Wright's direction. The first draft of the app is by Catherine Cavin. The live test report is by Zhu Lan (Kai).
