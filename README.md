# AI Use Assessment

[![Tests](https://github.com/Triodian/use-assessment/actions/workflows/tests.yml/badge.svg)](https://github.com/Triodian/use-assessment/actions/workflows/tests.yml) [![Licence: Apache 2.0](https://img.shields.io/badge/licence-Apache%202.0-blue.svg)](LICENSE)

AI Use Assessment measures the AI used in a regulated entity's supply chain, starting with general insurers, against
the entity's AI risk appetite. Working from the entity's own documents, without approaching providers, it builds a
register of the arrangements where AI acts for the entity, classifies each by authority and consequence, has each
classification peer reviewed, and reports what sits above the appetite and what is not known. The appetite comes from
the [AI Risk Appetite](https://github.com/Triodian/risk_appetite) app as a calibration set.

> The app records facts and the positions people take. It is not legal advice and does not say what the law requires;
> counsel decides what applies.

**Try it.** The demo runs at [use-assessment.triodian.com](https://use-assessment.triodian.com), with a worked example you can open without changing
anything. Ask Triodian for the demo sign-in.

**Run it yourself.** It runs as a Cloudflare Worker with a D1 database. See [Running locally](#running-locally) and
[Tests](#tests) below, and the [installer](https://github.com/Triodian/triodian-install) to put it into your own
Cloudflare account.

## Part of the Triodian AI governance apps

| App | What it is for |
| --- | --- |
| [AI Obligations Atlas](https://github.com/Triodian/obligations-atlas) | The AI governance obligations that apply by jurisdiction and use case, tiered by source, with a matter brief for counsel |
| [AI Board Direction](https://github.com/Triodian/board-direction) | A board sets its direction on AI: where to use it, what to rule out, what comes back to the board |
| [AI Risk Appetite](https://github.com/Triodian/risk_appetite) | A regulated entity settles its appetite for AI risk, for the board to approve |
| [AI Use Assessment](https://github.com/Triodian/use-assessment) | The AI in a regulated entity's supply chain, measured against that appetite |
| [AI Confidentiality Exposure Assessment](https://github.com/Triodian/Confidentiality-Exposure-Assessment) | Where confidential information in one transaction can reach an external AI model |
| [Installer and suite test](https://github.com/Triodian/triodian-install) | Puts the apps a client needs into a Cloudflare account, and tests them together |

The engagement apps are separate, each with its own repo and database. Deployed together they share one sign-in and
reach each other through Cloudflare service bindings.

## How it is built

Single-assessment web app: each deployment holds one assessment for one insurer.
It runs as a Cloudflare Worker: the files in `public/` are served as static assets, and `src/worker.js` handles `/api/*`.
The server design is the same as the AI Risk Appetite app's (`Triodian/risk_appetite`).

- `public/` – the app
  - `/` – the assessment (`index.html`, `aua.js`, `aua-content.js`, `app.css`) and the worked example for practice
  - `/admin/` – users, their roles, access requests and activity (administrators only), from `account.js`
  - `/profile/` – your name, organisation and email address, from `account.js`
- `src/worker.js` – Cloudflare entry point, and the link that reads the Risk Appetite app's calibration set
- `lib/core/` – cloud-neutral API (`api.js`), roles (`roles.js`), the server-side save check (`rbac.js`), three-way merge
- `lib/identity/cloudflare-access.js` – verifies the Cloudflare Access sign-in
- `lib/store/d1.js` – database access (Cloudflare D1)
- `lib/config.js` – Access team domain and AUD tag, first administrator
- `wrangler.jsonc` – Worker configuration (name, custom domain, database, test site)
- `docs/specs/` – build specification, fix specifications, framework
- `tests/rbac.test.mjs` – permission rules (`node tests/rbac.test.mjs`)

## How it works
- Everyone signs in through Cloudflare Access; the app's user list (managed in `/admin`) decides who gets in.
- A person can hold several roles (for example assessor and peer reviewer). Everyone with a role appears under People in set-up.
- Every change is saved to the server within about a second. The server checks each save against the signed-in person's
  roles, including the rules that depend on who did what: blind peer re-derivation (R3), independent validation (R4),
  confirmations in one's own name. History is append-only and signed by the server.
- Two people editing at once: their changes are merged; only a change to the very same item by both is refused, naming the item.
- The worked example runs in the browser only and is never saved.

## My actions and email notifications
- **My actions** (first in the header, with a count) lists what is waiting for the signed-in person, by their roles:
  facts or classification to finish, a failure consequence to confirm, a blind re-derivation, an R3 difference,
  questions to answer, review points, and sign-offs (R1, R2, R4 to R7, the annex, the hand-back list). Each item opens where the work is.
- **Email notifications** (`lib/core/notify.js`) are switched on, sent from notifications@triodian.com through Cloudflare Email Service (`triodian.com` must be onboarded there). A save that gives someone something to do
  writes a message to the notifications table: a question to counsel → counsel; an answer → the method owner; a proposed
  consequence → the arrangement owner; a recorded tier → peer reviewers; an R3 difference → the classifier and method owner;
  a review point → the method owner and delivery manager; a response → the independent reviewer; R7 complete → counsel and the GC.
  Daily at 07:00 Brisbane time, counsel is reminded of questions open for a week or more.
- Every message is listed in **Admin → Notifications** as Sent, or Failed with the reason (for example while the domain is
  not yet onboarded). Setting `NOTIFY_SENDING` to "off" in `wrangler.jsonc` holds messages there instead. Each person can turn the emails off in Profile. A notification problem never stops a save.
- Tests: `node tests/notify.test.mjs`

## Versions and the redline
- A version is kept at each sign-off: the set agreed (R1), counsel review recorded (R6), the independent check complete (R7),
  the annex signed and the hand-back list accepted. The server adds them (`lib/core/versions.js`); a browser cannot add,
  change or remove one. Each keeps every entry's field values, each arrangement's finding and the arrangement names.
- Outputs → **Compare versions** compares any version with a later one, or with the assessment now: old values struck
  through, new values beside them, and who last changed each field.
- The register (DL1) and the technical annex (DL5) end with **Changes since** the latest version.
- Tests: `node tests/versions.test.mjs`

## The next annual assessment
- Once an assessment is closed (R7 complete and the hand-back list accepted), an administrator or the method owner can
  **Start the next assessment** from Set-up. The closed one is kept read only (`engagement_archive` table) and listed under
  **Earlier assessments** in the menu. Nothing can be changed or saved there.
- The new assessment keeps set-up, people, the set and each entry's facts (fields 1 to 14, with sources) as a starting point,
  marked "carried over" until someone confirms or changes them. Classification, evidence, questions, reviews, sign-offs,
  versions and history start afresh (`lib/core/review.js`).
- Tests: `node tests/review.test.mjs`

## User guide
`/user-guide/` — linked from the start screen, the footer, the menu and the account menu.

## Calibration set from the Risk Appetite app
"Load from the Risk Appetite app" (Set-up → Calibration set) reads `/api/calibration-set` from the Risk Appetite app
using a Cloudflare Access service token. Set-up: `docs/calibration-link.md`. Loading from a file still works.

## Test site
A separate copy at `use-assessment-test.triodian.com` with its own database, deployed from the `test` branch. See `docs/test-site.md`.

## Tests
```
for f in tests/*.test.mjs; do node "$f"; done
cd tests/e2e && npm ci && npx playwright install chromium && npx playwright test
```

## Running locally
```
npx wrangler dev --local-upstream localhost --var LOCAL_DEV_NO_SIGNIN_EMAIL:you@example.com
```
`LOCAL_DEV_NO_SIGNIN_EMAIL` only works on localhost. Locally, an `X-Dev-User` header picks a different user for testing.

## Contributing

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).
Report security problems privately, as [SECURITY.md](SECURITY.md) describes, not as issues.

## Supporting the project

Use it, review it, tell us you use it, or fund its upkeep: see [SUPPORTING.md](SUPPORTING.md). Reviewers and organisations stay private unless they choose otherwise.

## Licence

AI Use Assessment is open source under the [Apache License, Version 2.0](LICENSE). Copyright 2026 Triodian Pty Ltd.
Third-party components bundled with it keep their own licences; see [`NOTICE`](NOTICE).
