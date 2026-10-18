# Reading the calibration set from the Risk Appetite app

The Risk Appetite app publishes the issued calibration set at `/api/calibration-set`: the latest version the board
approved, or before any approval the latest the CRO agreed. That site is behind Cloudflare Access, so this app reads it
with a **service token** (a machine sign-in) rather than a person's sign-in. A service token has no email address; its
Client ID identifies it. The Risk Appetite Worker lets exactly one service token, the one whose Client ID it is given,
read that one address and nothing else.

All of these steps are in the Cloudflare dashboard (one.dash.cloudflare.com for Zero Trust, dash.cloudflare.com for Workers).

## 1. Create the service token (Zero Trust)

Zero Trust → Access controls → Service credentials → Service tokens → **Create service token**.

- Name: `use-assessment`.
- Duration: a year is a sensible choice; put a reminder in the calendar a month before it expires. (Non-expiring also works.)
- After you create it, Cloudflare shows the **Client ID** (ends in `.access`) and the **Client Secret** once. Copy both
  somewhere safe now. If you lose the secret, create a new token.

## 2. Let the token through Access to the Risk Appetite app (Zero Trust)

Zero Trust → Access controls → Applications → the **Risk Appetite** application → Policies → **Add a policy**:

- Name: `Use Assessment service token`
- Action: **Service Auth** (not Allow; Allow is for people and would send the token to a sign-in page)
- Include: **Service Token** = `use-assessment`
- Save. Check the policy list shows it alongside the existing people policy.

If the test site (`risk-appetite-test.triodian.com`) is a separate Access application, add the same policy there too.

## 3. Tell the Risk Appetite Worker which token may read the set (Workers)

Workers & Pages → `risk-appetite` → Settings → Variables and secrets → **Add** → type **Secret**:

- `CALIBRATION_CLIENT_ID` = the Client ID from step 1 (the whole value, including `.access`).

Use a secret, not a plain variable: plain variables set in the dashboard are replaced by `wrangler.jsonc` on the next
deploy, and secrets are kept. Do the same on `risk-appetite-test` if you want the test sites linked.

## 4. Give this app the token (Workers)

Workers & Pages → `use-assessment` → Settings → Variables and secrets → **Add** two secrets:

- `APPETITE_CLIENT_ID` = the Client ID from step 1
- `APPETITE_CLIENT_SECRET` = the Client Secret from step 1

Do the same on `use-assessment-test`. `APPETITE_URL` is already set in `wrangler.jsonc`: the live site reads the live
Risk Appetite site, and the test site reads its test site.

## 5. Try it

In this app: Set-up → Calibration set → **Load from the Risk Appetite app**.

| What you see | What it means |
|---|---|
| The calibration set loads, with its version and status | Done. |
| "The link to the Risk Appetite app is not set up on this site yet" | Step 4 is missing on this Worker. |
| "No calibration set has been issued yet" | The link works. The CRO has not yet agreed a working appetite in the Risk Appetite app. |
| "This service token is not allowed to read the calibration set" | Step 3 is missing, or `CALIBRATION_CLIENT_ID` does not match the Client ID exactly. |
| "The Risk Appetite app answered 302/403. Check the service token and its policy." | Access did not accept the token: step 2 is missing or uses Allow instead of Service Auth, or the secret in step 4 is wrong. |

Until the link is set up, the set can still be loaded from a file (Set-up → Calibration set → Load from a file).
