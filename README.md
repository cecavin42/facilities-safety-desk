# Report-form UI/UX proposal

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
