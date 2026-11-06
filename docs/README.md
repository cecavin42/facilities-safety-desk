# How we work

Team A, spec-driven development course project. Facilities safety reporting and assistant for a
Tennessee university facilities department, modeled on UTK procedures.

## Roles (placeholder, not yet agreed by the team)
- Catherine: owns `docs/spec.md`. Agreed team answers go there, nowhere else.
- Forrest: drives the AI coding tool, owns branch workflow, deployment, and database setup.
- Zhu Lan: leads testing. Runs the checks in `docs/spec.md` section 13 on every preview deployment.

## Workflow
1. Pull `master`, then branch: `feature/<short-name>` or `docs/<short-name>`.
2. Push and open a PR. Vercel posts a preview URL on the PR automatically.
3. Test your own change on the preview before asking for review.
4. One approval, then merge. Never push to `master` directly.
5. Split work by area so two people never edit the same files at once.

## Where things live
- `docs/spec.md`: the specification (the 15 kickoff questions, team answers).
- `docs/test-questions.json`: the assistant test set. Every answer the app gives to these
  questions must contain the listed phrases and cite the listed sources. Decline cases included.
- `src/data/documents.json`: the five source documents the assistant may cite.
- `src/lib/validation.ts`: the incident report rules from spec section 7.
- `src/lib/assistant/` and `src/lib/search.ts`: the assistant's retrieval and answer logic.
- `src/lib/store.ts`: the browser's copy of the data it loads from the server.
- `db/migrations/` and `src/lib/db/`: PostgreSQL storage.
- `src/lib/server-access.ts` and `src/lib/authorized-data.ts`: sign-in checks and who may see what.
- `docs/DEPLOYMENT.md`: settings and steps for deploying to Vercel.

## Links
- Repo: https://github.com/cecavin42/facilities-safety-desk
- Pull requests: https://github.com/cecavin42/facilities-safety-desk/pulls
- Production site: https://facilities-safety-desk.vercel.app
- Preview deployments: posted by the Vercel bot as a comment on each PR.
- Team notes doc (the 15 kickoff questions and our individual answers): https://docs.google.com/document/d/1TAaos8jNJKEJbnXZEK7myPIDHbrcKAcv7-SbTT1VutY/edit
- Source documents: URLs are in `src/data/documents.json`.
