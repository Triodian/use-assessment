# The calibration link to the AI Risk Appetite app

The **Load from the Risk Appetite app** button in Use Assessment reads the calibration set the Risk Appetite app has
issued. Since development plan task 1B.4 it does this through a Cloudflare **service binding**: a direct call from
the Use Assessment Worker to the Risk Appetite Worker inside the same Cloudflare account. There is no public URL, no
service token and no secret to create or rotate.

## How it is set up

Nothing to do by hand. `wrangler.jsonc` binds each environment to its own Risk Appetite Worker:

| Use Assessment Worker | Binds to | Entrypoint |
| --- | --- | --- |
| `use-assessment` | `risk-appetite` | `AppetiteService` |
| `use-assessment-test` | `risk-appetite-test` | `AppetiteService` |
| `use-assessment-client` | `risk-appetite-client` | `AppetiteService` |

The Risk Appetite app exports `AppetiteService` from `src/service.js`. It offers one method, `calibrationSet()`, which
returns the issued set and nothing else. Deploy the Risk Appetite app first, so the entrypoint exists when Use
Assessment is deployed.

Both Workers must be in the same Cloudflare account.

## After the binding works

The older link used an Access service token. Once **Load from the Risk Appetite app** works on live and test:

1. On `use-assessment` and `use-assessment-test`, delete the secrets `APPETITE_CLIENT_ID` and `APPETITE_CLIENT_SECRET`.
2. On `risk-appetite` and `risk-appetite-test`, delete the secret `CALIBRATION_CLIENT_ID`.
3. In Zero Trust, revoke the `Use Assessment service token` and remove its Service Auth policy from the Risk Appetite
   Access application.

The service-token code stays for one release so a site without the binding keeps working, then goes.

## If it fails

| Message | Cause |
| --- | --- |
| "could not be reached through the APPETITE service binding" | The Risk Appetite Worker named in the binding is not deployed in this account, or was deployed before `AppetiteService` existed. Deploy it again. |
| "No calibration set has been issued yet" | The CRO has not agreed the working appetite in the Risk Appetite app. |
| "The link to the Risk Appetite app is not set up on this site yet" | The Worker has no `APPETITE` binding. Check `wrangler.jsonc`, or load the calibration set from a file. |
