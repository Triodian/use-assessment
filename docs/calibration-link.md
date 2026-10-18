# Reading the calibration set from the Risk Appetite app

The Risk Appetite app publishes the issued calibration set at `/api/calibration-set`. That site is behind
Cloudflare Access, so this app reads it with a **service token** (a machine sign-in) rather than a person's sign-in.

1. Zero Trust → Access controls → Service credentials → Service tokens → **Create service token**,
   name `use-assessment`, duration non-expiring (or a year, with a reminder). Copy the Client ID and Client Secret
   (the secret is shown once).
2. Zero Trust → Access controls → Applications → the **Risk Appetite** application → Policies → **Add a policy**:
   name `Use Assessment service token`, action **Service Auth**, include **Service Token** = `use-assessment`. Save.
3. Workers & Pages → `use-assessment` → Settings → Variables and secrets → add two **secrets**:
   `APPETITE_CLIENT_ID` and `APPETITE_CLIENT_SECRET`. Do the same on `use-assessment-test`.
4. `APPETITE_URL` is already set in `wrangler.jsonc` (live reads the live Risk Appetite site; test reads its test site).

Until the secrets are set, the button says the link is not set up, and the set can be loaded from a file.
The Risk Appetite app returns 404 until a calibration set has been issued there.
