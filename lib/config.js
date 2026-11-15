// Settings for this deployment. None of these are secrets.

// Cloudflare Access (sign-in). Found in Cloudflare Zero Trust:
//   teamDomain: Settings → Custom pages → Team domain
//   aud:        Access → Applications → Use Assessment → "Application Audience (AUD) Tag"
// Can be overridden by Worker variables ACCESS_TEAM_DOMAIN and ACCESS_AUD.
export const ACCESS = {
  teamDomain: 'damian-hickey-30c.cloudflareaccess.com',
  aud: 'e1611e33331a9bd6fed741f3a75ca7b1cbba9b69420889f2dcf7e0ff55f83f92', // the "Use Assessment" application (covers the live and test addresses)
};

// First administrator(s): the Worker variable FIRST_ADMINS (comma-separated), set for each deployment by the installer or
// the provisioning script. Nothing is compiled in (security review 15 Nov 2026, S.4). While the deployment has never had an
// administrator, a listed person becomes one on first sign-in; after that the path is closed and admins are managed in /admin.
