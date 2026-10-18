# AI Use Assessment (Triodian)

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

## Calibration set from the Risk Appetite app
"Load from the Risk Appetite app" (Set-up → Calibration set) reads `/api/calibration-set` from the Risk Appetite app
using a Cloudflare Access service token. Set-up: `docs/calibration-link.md`. Loading from a file still works.

## Test site
A separate copy at `use-assessment-test.triodian.com` with its own database, deployed from the `test` branch. See `docs/test-site.md`.

## Running locally
```
npx wrangler dev --local-upstream localhost --var LOCAL_DEV_NO_SIGNIN_EMAIL:you@example.com
```
`LOCAL_DEV_NO_SIGNIN_EMAIL` only works on localhost. Locally, an `X-Dev-User` header picks a different user for testing.
