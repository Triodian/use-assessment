// Versions kept at each sign-off, by the server only.  node tests/versions.test.mjs
import { checkSave } from '../lib/core/rbac.js';
import { snapshotOf } from '../lib/core/versions.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fails++; };
const users = [{ id: 'gc', roles: ['gc'], active: true, name: 'Helen' }, { id: 'co', roles: ['counsel'], active: true, name: 'Meredith' }, { id: 'mo', roles: ['methodOwner'], active: true, name: 'Sam' }];
const base = { schema: 'triodian.aua.v1', engagement: { id: 'e1', insurer: 'Corvane' }, setAgreed: { gcBy: 'gc', gcOn: '2026-10-10', counselBy: '', counselOn: '' }, arrangements: [{ id: 'ARR-01', name: 'Claims' }], entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: { 7: { value: 'Triage model', source: 'D5' } } }], reviews: [], history: [], versions: [] };
{ const n = structuredClone(base); n.setAgreed.counselBy = 'co'; n.setAgreed.counselOn = '2026-10-11';
  const r = checkSave(base, n, users[1], users);
  check('counsel completing R1 adds V1: ' + (r.error || ''), !r.error && r.newVersion && r.data.versions.length === 1 && r.data.versions[0].label === 'Set agreed (R1)' && r.data.versions[0].snapshot.entries['REG-001'].f[7] === 'Triage model' && r.data.versions[0].by === 'Meredith'); }
{ const n = structuredClone(base); n.versions = [{ id: 'V1', label: 'forged', snapshot: {} }];
  const r = checkSave(base, n, users[0], users);
  check('a browser cannot add a version: ' + (r.error || ''), !r.error && r.data.versions.length === 0); }
{ const old = structuredClone(base); old.versions = [{ id: 'V1', label: 'Set agreed (R1)', snapshot: { entries: {} } }]; const n = structuredClone(old); n.versions = [];
  const r = checkSave(old, n, users[0], users);
  check('a browser cannot remove a version', !r.error && r.data.versions.length === 1); }
{ // Values the browser works out (fields 17, 21, 22, 26 and the findings) are not kept, so a redline straight after a sign-off shows no change.
  const d = structuredClone(base); Object.assign(d.entries[0].fields, { 17: { value: 'E2' }, 21: { value: 'yes' }, 26: { value: 'F1' } }); d.findings = [{ arrangementId: 'ARR-01', type: 'F1' }];
  const s = snapshotOf(d), f = s.entries['REG-001'].f;
  check('a version keeps no derived values', f[7] === 'Triage model' && !(17 in f) && !(21 in f) && !(26 in f) && !Object.keys(s.findings).length); }
console.log(fails ? fails + ' failed' : 'all passed'); if (fails) process.exit(1);
