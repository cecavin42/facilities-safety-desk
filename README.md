# Authenticated Facilities Safety Desk — draft

This branch adds working sign-in and server-enforced Employee / Safety manager access to the full-app draft. Employees can read only their own reports. Administrators manage the shared register, imports, insights and approved accounts. Public registration is disabled.

Start the isolated local review with `npm ci` and `npm run auth:local`, then open http://127.0.0.1:3103 . Generated local-only credentials are in `.local/review-accounts.json`; secrets and credentials are excluded from Git. The earlier unauthenticated preview remains on port 3102.

See [sign-in and access review](docs/AUTH_REVIEW.md) for the role matrix, implementation details, tests, limitations and hosting handoff. [Full-app review](docs/APP_REVIEW.md) and [assistant review](docs/ASSISTANT_REVIEW.md) describe the preceding drafts; their browser-local storage notes are historical for this branch.

Validation commands: `npm run test:app`, `npm run test:assistant`, `npm run test:auth-config`, `npm run test:access` (with the local auth app running), `npm run lint`, and `npm run build`.

All changes remain draft for team review. The hosted database, actual team accounts, SSO/MFA and email recovery are not configured by this branch. No production merge or additional student hours are implied.
