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

// ---- through the API: every response that carries the assessment is redacted for the reader (security review 15 Nov 2026, S.1) ----
{
  const { handle } = await import('../lib/core/api.js');
  const apiUsers = users.map(u => ({ ...u, email: u.id + '@x.test', isAdmin: false }));
  let eng = { revision: 3, data: structuredClone(stored), updatedAt: 't', updatedBy: 'Jo' }; const archive = [{ id: 1, label: 'earlier', data: structuredClone(stored) }];
  const store = new Proxy({ init: async () => {}, getUserByEmail: async e => apiUsers.find(u => u.email === e) || null, touchUser: async () => {}, listUsers: async () => apiUsers, getEngagement: async () => eng, audit: async () => {},
    putEngagement: async (t, from, by, at) => { if (from !== eng.revision) return false; eng = { revision: from + 1, data: JSON.parse(t), updatedAt: at, updatedBy: by }; return true; },
    getRevision: async () => null, listArchive: async () => archive.map(a => ({ id: a.id, label: a.label })), getArchive: async id => { const a = archive.find(x => x.id === id); return a ? { ...a, archived_at: 'x', archived_by: 'mo' } : null; } },
    { get: (t, k) => k in t ? t[k] : (k === 'then' ? undefined : async () => null) });
  const call = (email, method, path, body) => handle({ method, path, email, text: async () => JSON.stringify(body || {}) }, store);
  const leaks = o => { const s = JSON.stringify(o); return ['"A3"', '"to":"A3"', 'classifiedBy":"as"'].filter(x => s.includes(x)); };
  const got = await call('pe@x.test', 'GET', '/api/engagement');
  check('GET /engagement is redacted for a blind peer', got.status === 200 && leaks(got.body).length === 0 && got.body.data.blind.includes('REG-001'));
  // The peer saves a fact on an entry they may edit nothing of; no history entry is added.
  const same = structuredClone(got.body.data);
  const r0 = await call('pe@x.test', 'PUT', '/api/engagement', { revision: 3, data: same });
  check('a save that adds no history returns an empty history delta, not the whole history: ' + r0.status + ' ' + (r0.body.error || ''), r0.status === 200 && Array.isArray(r0.body.history) && r0.body.history.length === 0 && leaks(r0.body).length === 0);
  // A save that adds history: the delta is redacted for the reader too.
  const next = structuredClone(got.body.data); next.entries[0].peerReview = { personId: 'pe', tier: 'A2', differs: false, resolution: '', on: '2026-11-15' };
  next.history.push({ at: 't3', by: 'Ravi', action: 'peerReview', target: 'REG-001', from: null, to: 'A2' });
  const r1 = await call('pe@x.test', 'PUT', '/api/engagement', { revision: 4, data: next });
  check('the history delta carries only what was added and nothing withheld: ' + r1.status + ' ' + (r1.body.error || ''), r1.status === 200 && r1.body.history.length === 1 && r1.body.reload === true && leaks({ h: r1.body.history }).length === 0);
  const a = await call('pe@x.test', 'GET', '/api/archive/1');
  check('an earlier assessment is redacted for a blind peer too', a.status === 200 && leaks(a.body).length === 0);
  const full = await call('as@x.test', 'GET', '/api/archive/1');
  check('and not for the assessor', full.status === 200 && full.body.data.entries[0].fields[15].value === 'A3');
}
console.log(fails ? fails + ' failed' : 'all passed'); if (fails) process.exit(1);
