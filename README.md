# Facilities Safety Desk — team review draft

This draft adds authenticator MFA, administrator-assisted account recovery, a versioned source library, stronger source-scoped assistant answers, and encrypted backup/restore tooling to the designed, authenticated application. See the [current readiness review](docs/READINESS_REVIEW.md) for verified behavior, evidence, operating instructions and remaining hosted/human checks. Nothing has been merged to production.

The [design review and asset credits](docs/DESIGN_REVIEW.md) cover the product shell, original brand assets, live overview, compact register and responsive navigation.

## Authenticated application

This branch adds working sign-in and server-enforced Employee / Safety manager access to the full-app draft. Employees can read only their own reports. Administrators manage the shared register, imports, insights and approved accounts. Public registration is disabled.

Start the isolated local review with `npm ci` and `npm run auth:local`, then open http://127.0.0.1:3103 . Generated local-only credentials are in `.local/review-accounts.json`; secrets and credentials are excluded from Git. The earlier unauthenticated preview remains on port 3102.

See [sign-in and access review](docs/AUTH_REVIEW.md) for the role matrix, implementation details, tests, limitations and hosting handoff. [Full-app review](docs/APP_REVIEW.md) and [assistant review](docs/ASSISTANT_REVIEW.md) describe the preceding drafts; their browser-local storage notes are historical for this branch.

Validation commands: `npm run test:app`, `npm run test:assistant`, `npm run test:catalog`, `npm run test:client`, `npm run test:auth-config`, `npm run lint`, and `npm run build`. With the isolated local auth app running, use `npm run test:access`, `npm run test:mfa`, `npm run test:sources`, `npm run test:concurrency`, `npm run test:restore`, and `npm run eval:challenge`. Run the live suites sequentially because they share isolated test state.

All changes remain draft for team review. MFA and private administrator-assisted recovery are implemented locally; actual people must enroll their own authenticators. Hosted credentials, actual team accounts, university SSO, email delivery and independent teammate acceptance remain unconfigured or unverified. No production merge or additional student hours are implied.
