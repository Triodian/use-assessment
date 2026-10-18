// Settings for this deployment. None of these are secrets.

// Cloudflare Access (sign-in). Found in Cloudflare Zero Trust:
//   teamDomain: Settings → Custom pages → Team domain
//   aud:        Access → Applications → Use Assessment → "Application Audience (AUD) Tag"
// Can be overridden by Worker variables ACCESS_TEAM_DOMAIN and ACCESS_AUD.
export const ACCESS = {
  teamDomain: 'damian-hickey-30c.cloudflareaccess.com',
  aud: '', // set once the Use Assessment Access application exists; until then the API refuses every request
};

// First administrator(s). While the user list has no active administrator, these people are
// added as administrators the first time they sign in. After that, admins are managed in /admin.
export const BOOTSTRAP_ADMINS = ['damian.hickey@triodian.com'];
