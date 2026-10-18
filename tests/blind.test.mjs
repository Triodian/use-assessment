// Blind re-derivation is enforced on the server.  node tests/blind.test.mjs
import { redactFor, unredactSave } from '../lib/core/blind.js';
import { checkSave } from '../lib/core/rbac.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fails++; };
const users = [{ id: 'as', roles: ['assessor'], active: true, name: 'Jo' }, { id: 'pe', roles: ['peer'], active: true, name: 'Ravi' }, { id: 'mo', roles: ['methodOwner'], active: true, name: 'Sam' }];
const [AS, PE] = users;
const stored = { schema: 'triodian.aua.v1', engagement: { id: 'e1' }, arrangements: [{ id: 'ARR-01' }], reviews: [], versions: [{ id: 'V1', label: 'x', snapshot: { entries: { 'REG-001': { arr: 'ARR-01', f: { 7: 'Triage', 15: 'A3' } } }, findings: { 'ARR-01': 'F2' } } }],
  entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: { 7: { value: 'Triage', source: 'D5' }, 11: { value: 'Routes claims', source: 'D5' }, 15: { value: 'A3' }, 16: { value: 'C4' } }, tierProposed: 'A3', classifiedBy: 'as', authorityTests: [{ answer: true, source: 'D5' }, { answer: false, source: '' }, { answer: null, source: '' }, { answer: null, source: '' }], peerReview: { personId: '', tier: '', differs: false, resolution: '', on: '' }, expectedRung: { value: 'E4' } }],
  findings: [{ arrangementId: 'ARR-01', type: 'F2' }], history: [{ at: 't', by: 'Jo', action: 'field 15', target: 'REG-001', from: null, to: 'A3' }] };
const seen = redactFor(stored, PE), e = seen.entries[0];
check('a peer is not sent the tier, later fields, proposal, tests or classifier', !e.fields[15] && !e.fields[16] && e.tierProposed === '' && e.classifiedBy === '' && e.authorityTests.every(t => t.answer === null) && !e.expectedRung);
check('a peer still sees the facts', e.fields[7].value === 'Triage' && e.fields[11].value === 'Routes claims');
check('history and versions do not give the tier away', seen.history[0].to === undefined && seen.history[0].action === 'hidden' && !seen.versions[0].snapshot.entries['REG-001'].f[15] && seen.findings.length === 0);
check('the assessor and the method owner see everything', redactFor(stored, AS) === stored && redactFor(stored, users[2]) === stored);
check('the stored data itself is untouched', stored.entries[0].fields[15].value === 'A3');
// the peer saves their blind tier from the redacted copy
const mine = JSON.parse(JSON.stringify(seen)); mine.entries[0].peerReview = { personId: 'pe', tier: 'A2', differs: false, resolution: '', on: '2026-10-18' }; mine.history.push({ at: 't2', by: 'Ravi', action: 'peerReview', target: 'REG-001', from: null, to: 'A2' });
const ur = unredactSave(stored, mine, PE);
check('the withheld values are put back on save', ur.data.entries[0].fields[15].value === 'A3' && ur.data.entries[0].classifiedBy === 'as' && ur.data.entries[0].tierProposed === 'A3' && ur.data.history[0].to === 'A3' && ur.data.findings[0].type === 'F2');
check('the server decides the tiers differ, and the peer is told to reload', ur.data.entries[0].peerReview.differs === true && ur.unblinded === true);
const r = checkSave(stored, ur.data, PE, users);
check('the peer’s save passes the rules: ' + (r.error || ''), !r.error && r.data.entries[0].peerReview.tier === 'A2');
// a peer cannot use the redacted copy to change the classifier's work
const sneaky = JSON.parse(JSON.stringify(seen)); sneaky.entries[0].fields[15] = { value: 'A1' }; sneaky.entries[0].classifiedBy = 'pe';
const u2 = unredactSave(stored, sneaky, PE);
check('a peer cannot change the withheld values', u2.data.entries[0].fields[15].value === 'A3' && u2.data.entries[0].classifiedBy === 'as');
console.log(fails ? fails + ' failed' : 'all passed'); if (fails) process.exit(1);
