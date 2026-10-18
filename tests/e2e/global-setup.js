// A fresh local database for every run, with one user per role.
import { api, U, ROLES } from './helpers.js';

export default async function () {
  // .state is cleared by the CI job before the server starts; locally, delete tests/e2e/.state for a clean run.
  for (const [k, email] of Object.entries(U)) {
    const r = await api('POST', '/api/admin/users', { email, name: k + ' (test)', organisation: 'Test', roles: ROLES[k], isAdmin: false, active: true });
    if (r.status !== 201 && r.status !== 409) throw new Error(`Could not create ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  }
}
