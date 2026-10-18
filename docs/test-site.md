# Test site: use-assessment-test.triodian.com

A separate copy of the app for trying changes before they reach the live assessment.
It has its own Worker (`use-assessment-test`) and its own database (`use-assessment-test-db`), so nothing done there
touches the live assessment. A banner on every page says "Test site". It reads the calibration set from the
Risk Appetite **test** site.

## Day to day
- Changes go to the `test` branch first; Cloudflare deploys them to the test site.
- When they have been checked there, merge `test` into `main`; Cloudflare deploys the live site.
- The first person listed in `BOOTSTRAP_ADMINS` (lib/config.js) to sign in becomes the site's administrator.
  Add test users in its Admin, separately from the live site.
- To start the test site again from empty, delete and re-create the test database.

## Cloudflare Workers (one each)
| | Live | Test |
|---|---|---|
| Worker name | `use-assessment` | `use-assessment-test` |
| Branch | `main` | `test` |
| Deploy command | `npx wrangler deploy` | `npx wrangler deploy --env test` |
| Address | use-assessment.triodian.com | use-assessment-test.triodian.com |
| Database | use-assessment-db | use-assessment-test-db |

Both addresses are covered by the "Use Assessment" Access application. Preview builds are off.
