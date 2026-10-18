// Starting the next annual assessment.  node tests/review.test.mjs
import { handle } from '../lib/core/api.js';
import { nextAssessment, isClosed } from '../lib/core/review.js';
let fails = 0; const check = (n, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fails++; };
const users = [{ id: 'mo', email: 'mo@x.test', name: 'Sam', roles: ['methodOwner'], active: true, isAdmin: false }, { id: 'as', email: 'as@x.test', name: 'Jo', roles: ['assessor'], active: true, isAdmin: false }];
const closed = { schema: 'triodian.aua.v1', engagement: { id: 'e1', insurer: 'Corvane', reference: 'AUA-1', handBack: { by: 'ow', on: '2026-11-30' }, annexSigned: { by: 'mo', on: '2026-11-20' } },
  setAgreed: { gcBy: 'gc', counselBy: 'co' }, arrangements: [{ id: 'ARR-01', name: 'Claims', findingOwner: 'x' }], documents: [{ id: 'D1', status: 'received', date: '2026-10-01' }], interviews: [{ id: 'IV-1' }],
  entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: { 7: { value: 'Triage', source: 'D5' }, 15: { value: 'A3' }, 16: { value: 'C4' } }, classifiedBy: 'as', peerReview: { personId: 'pe', tier: 'A3' }, expectedRung: { value: 'E4' } }],
  questions: [{ ref: 'QC-01' }], reviews: [{ point: 'R7', result: 'complete', on: '2026-11-28' }], versions: [{ id: 'V1' }], history: [{ at: 'x' }] };
check('closed when R7 complete and hand-back accepted', isClosed(closed) && !isClosed({ ...closed, reviews: [] }));
const n = nextAssessment(closed, 'e2', 'mo@x.test', '2026-12-01T00:00:00Z', 'Corvane · closed');
check('facts carry over, classification does not', n.entries[0].fields[7].value === 'Triage' && n.entries[0].fields[7].carried && !n.entries[0].fields[15] && !n.entries[0].classifiedBy && !n.entries[0].peerReview.tier && !n.entries[0].expectedRung);
check('sign-offs, questions, reviews, versions cleared', !n.engagement.handBack.by && !n.engagement.annexSigned.by && !n.setAgreed.gcBy && !n.questions.length && !n.reviews.length && !n.versions.length && n.history.length === 1);
check('set and set-up kept; documents reset; new id', n.arrangements.length === 1 && n.engagement.insurer === 'Corvane' && n.documents[0].status === '' && n.engagement.id === 'e2' && n.previous.label === 'Corvane · closed');
// through the API
let eng = { revision: 5, data: structuredClone(closed) }; const archive = [];
const store = new Proxy({ init: async () => {}, getUserByEmail: async e => users.find(u => u.email === e) || null, touchUser: async () => {}, listUsers: async () => users, getEngagement: async () => eng, audit: async () => {},
  putEngagement: async (t, from) => { if (from !== eng.revision) return false; eng = { revision: from + 1, data: JSON.parse(t) }; return true; },
  archiveEngagement: async (label, text) => { archive.push({ id: archive.length + 1, label, data: JSON.parse(text) }); return archive.length; },
  listArchive: async () => archive.map(a => ({ id: a.id, label: a.label })), getArchive: async id => { const a = archive.find(x => x.id === id); return a ? { ...a, archived_at: 'x', archived_by: 'mo' } : null; } },
  { get: (t, k) => k in t ? t[k] : (k === 'then' ? undefined : async () => null) });
const call = (email, method, path, body) => handle({ method, path, email, text: async () => JSON.stringify(body || {}) }, store);
check('an assessor cannot start it', (await call('as@x.test', 'POST', '/api/next-assessment', { revision: 5 })).status === 403);
const r = await call('mo@x.test', 'POST', '/api/next-assessment', { revision: 5 });
check('the method owner starts it: ' + r.status + ' ' + (r.body.error || ''), r.status === 200 && eng.revision === 6 && eng.data.engagement.id !== 'e1' && archive.length === 1);
const l = await call('as@x.test', 'GET', '/api/archive'), a = await call('as@x.test', 'GET', '/api/archive/1');
check('anyone can read earlier assessments', l.status === 200 && l.body.entries.length === 1 && a.status === 200 && a.body.data.reviews[0].result === 'complete');
check('the new one is not closed, so it cannot be carried forward again', (await call('mo@x.test', 'POST', '/api/next-assessment', { revision: 6 })).status === 409);
console.log(fails ? fails + ' failed' : 'all passed'); if (fails) process.exit(1);
