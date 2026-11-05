# Full-app quality proposal (draft)

This draft builds on the assistant proposal (#5). It refreshes the overview, navigation, register, CSV import and insights; preserves unfinished form drafts in the current tab; confirms status writes before showing success; and synchronizes browser data across tabs. It incorporates the stronger CSV checks from the database draft without requiring a hosted database. The last-updated indicator remains in the overview.

Run `npm run test:app` for storage, import, filter and analytics regressions. See [full-app review notes](docs/APP_REVIEW.md) for screenshots and observed end-to-end checks. This is still a browser-local classroom demo. Authentication, shared hosted storage and team acceptance remain separate work; no numeric quality score is claimed from internal tests alone.

## Assistant quality proposal

This branch adds clearer source-backed answers, explicit jurisdiction and coverage limits, an optional local AI interpreter, and a redesigned assistant experience. It builds on the report-form draft (PR #4); shared PostgreSQL remains in PR #3. Team review is pending. No production merge or deployment is implied.

Run `npm ci`, then `npm run assistant:local` and open http://127.0.0.1:3102/assistant. The launcher builds the app and warms the already-installed `qwen3.6:35b-a3b` model through local Ollama. It downloads no models. Without Ollama, the source guide still works and is labeled accordingly. For a normal source-guide preview, use `npm run build` followed by `npm start`.

Run `npm run test:assistant`, `npm run test:ui`, `npm run lint`, and `npm run build`. `npm run eval:assistant` compares the saved original retrieval behavior with the draft on the development cases. See [assistant review notes](docs/ASSISTANT_REVIEW.md) for architecture, evidence, limits and database integration.

## Report-form UI/UX proposal

This branch improves the existing incident-report flow while preserving the team app's teal styling and validation rules. It is based on the current master branch, so its preview can run before the shared Postgres connection is available.

- Three labeled sections: when/where, what happened, reporter details.
- Required/optional guidance, readable mobile controls, linked error summary and field-level screen-reader descriptions.
- Confirmation with the record ID and a path to Records or another report.
- Failed browser-storage writes keep the entered report and never claim success. Existing unreadable records are not overwritten.
- This preview still uses browser-local demo storage. The Postgres work remains in PR #3.

Validation: `npm run test:ui`, `npm run lint`, `npm run build`, plus browser checks of required/conditional fields, save confirmation, persistence, keyboard focus and responsive layout. AI-assisted implementation by Codex at Forrest's direction; team review is pending.

`IncidentReportForm` accepts an asynchronous `onSave(record, requestId)` callback and optional loading/error props so the same interface can use the Postgres adapter when that work is integrated.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
