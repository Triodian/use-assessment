// Settings for this deployment. None of these are secrets.

// Cloudflare Access (sign-in). Found in Cloudflare Zero Trust:
//   teamDomain: Settings → Custom pages → Team domain
//   aud:        Access → Applications → Use Assessment → "Application Audience (AUD) Tag"
// Can be overridden by Worker variables ACCESS_TEAM_DOMAIN and ACCESS_AUD.
export const ACCESS = {
  teamDomain: 'damian-hickey-30c.cloudflareaccess.com',
  aud: 'e1611e33331a9bd6fed741f3a75ca7b1cbba9b69420889f2dcf7e0ff55f83f92', // the "Use Assessment" application (covers the live and test addresses)
};

// First administrator(s). While the user list has no active administrator, these people are
// added as administrators the first time they sign in. After that, admins are managed in /admin.
export const BOOTSTRAP_ADMINS = ['damian.hickey@triodian.com'];
