// Notification rules: who hears about what when a save changes the assessment.  node tests/notify.test.mjs
import { eventsFromSave, dueReminders, deliver } from '../lib/core/notify.js';
import { handle } from '../lib/core/api.js';

let fails = 0;
const check = (name, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + name); if (!ok) fails++; };
const U = (id, roles, extra) => Object.assign({ id, email: id + '@x.test', name: id, roles, active: true, notify: true, isAdmin: false }, extra || {});
const users = [U('mo', ['methodOwner'], { isAdmin: true }), U('as', ['assessor']), U('pe', ['peer']), U('co', ['counsel']), U('ow', ['owner']), U('ir', ['ir']), U('gc', ['gc']), U('dl', ['delivery'])];
const base = () => ({ schema: 'triodian.aua.v1', engagement: { insurer: 'Corvane' }, questions: [], entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: {}, peerReview: { personId: '', tier: '', differs: false }, classifiedBy: '' }], independentReviewPoints: [], reviews: [] });
const to = (msgs, subj) => msgs.filter(m => m.subject.includes(subj)).map(m => m.to.id).sort().join(',');

{ const a = base(), b = base(); b.questions.push({ ref: 'QC-01', question: 'Does the audit clause reach it?', status: 'open', entryId: 'REG-001' });
  check('new question → counsel', to(eventsFromSave(a, b, users, users[1], 'https://x'), 'Question to counsel') === 'co'); }
{ const a = base(); a.questions.push({ ref: 'QC-01', question: 'q', status: 'open' }); const b = structuredClone(a); b.questions[0].status = 'answered'; b.questions[0].response = 'Yes.';
  check('answered question → method owner', to(eventsFromSave(a, b, users, users[3], 'https://x'), 'Counsel answered') === 'mo'); }
{ const a = base(), b = base(); b.entries[0].fields[16] = { value: 'C4' };
  check('consequence proposed → owner', to(eventsFromSave(a, b, users, users[1], 'https://x'), 'failure consequence') === 'ow'); }
{ const a = base(), b = base(); b.entries[0].fields[15] = { value: 'A3' }; b.entries[0].classifiedBy = 'as';
  check('tier recorded → peer reviewer', to(eventsFromSave(a, b, users, users[1], 'https://x'), 'tier to re-derive') === 'pe'); }
{ const a = base(); a.entries[0].fields[15] = { value: 'A3' }; a.entries[0].classifiedBy = 'as'; const b = structuredClone(a); b.entries[0].peerReview = { personId: 'pe', tier: 'A2', differs: true };
  check('R3 difference → classifier and method owner', to(eventsFromSave(a, b, users, users[2], 'https://x'), 'R3 difference') === 'as,mo'); }
{ const a = base(), b = base(); b.independentReviewPoints.push({ ref: 'IR-01', point: 'Rung on ARR-01 not traceable', status: 'open', response: '' });
  check('review point → method owner and delivery', to(eventsFromSave(a, b, users, users[5], 'https://x'), 'Review point') === 'dl,mo'); }
{ const a = base(); a.independentReviewPoints.push({ ref: 'IR-01', point: 'p', status: 'open', response: '' }); const b = structuredClone(a); b.independentReviewPoints[0].response = 'Fixed.';
  check('response → independent reviewer', to(eventsFromSave(a, b, users, users[0], 'https://x'), 'Response to review point') === 'ir'); }
{ const a = base(), b = base(); b.reviews.push({ point: 'R7', result: 'complete' });
  check('R7 complete → counsel and GC', to(eventsFromSave(a, b, users, users[5], 'https://x'), 'Independent review complete') === 'co,gc'); }
{ const a = base(), b = base(); b.questions.push({ ref: 'QC-01', question: 'q', status: 'open' });
  check('the person saving is never emailed', to(eventsFromSave(a, b, users, users[3], 'https://x'), 'Question to counsel') === ''); }
{ const d = base(); d.questions.push({ ref: 'QC-01', question: 'q', status: 'open', sentOn: '2026-10-01' }, { ref: 'QC-02', question: 'q2', status: 'open', sentOn: '2026-10-16' });
  const r = dueReminders(d, users, '2026-10-18', 'https://x');
  check('daily reminder → counsel, week-old questions only', r.length === 1 && r[0].to.id === 'co' && r[0].text.includes('QC-01') && !r[0].text.includes('QC-02')); }

// deliver: held while sending is off; opt-out respected; duplicate daily keys skipped
{ const out = []; const store = { addNotification: async n => { out.push(n); return out.length; }, hasNotification: async k => out.some(n => n.key === k), markNotification: async () => {} };
  await deliver([{ to: U('a', []), subject: 's', text: 't' }, { to: U('b', [], { notify: false }), subject: 's', text: 't' }, { to: U('c', []), subject: 's', text: 't', key: 'k1' }, { to: U('c', []), subject: 's', text: 't', key: 'k1' }], store, null, 'now');
  check('held while off; opt-out skipped; one per key', out.length === 2 && out.every(n => n.status === 'held')); }

// End to end: a save through the API writes held notifications
{ const outbox = []; let eng = { revision: 1, data: Object.assign(base(), { history: [], people: [] }), updatedAt: 'x', updatedBy: 'as@x.test' };
  const store = new Proxy({
    init: async () => {}, getUserByEmail: async e => users.find(u => u.email === e) || null, touchUser: async () => {}, noteAccessRequest: async () => {}, countUsers: async () => users.length,
    listUsers: async () => users, getEngagement: async () => eng, getRevision: async () => null, audit: async () => {},
    putEngagement: async (text, from) => { eng = { revision: from + 1, data: JSON.parse(text) }; return true; },
    addNotification: async n => { outbox.push(n); return outbox.length; }, hasNotification: async () => false, markNotification: async () => {},
  }, { get: (t, k) => k in t ? t[k] : (k === 'then' ? undefined : async () => null) });
  const next = structuredClone(eng.data); next.questions.push({ ref: 'QC-01', arrangementId: '', entryId: '', question7: 1, facts: '', question: 'Is it reachable?', why: '', response: '', respondedOn: '', status: 'open', owner: '', sentOn: '2026-10-18', targetField: '' });
  next.history.push({ at: 'x', by: 'as', action: 'ask', target: 'QC-01' });
  const r = await handle({ method: 'PUT', path: '/api/engagement', email: 'as@x.test', text: async () => JSON.stringify({ revision: 1, data: next }), origin: 'https://x' }, store);
  check('save through the API: ' + r.status + (r.body.error ? ' ' + r.body.error : ''), r.status === 200 && outbox.length === 1 && outbox[0].to === 'co@x.test' && outbox[0].status === 'held'); }

console.log(fails ? fails + ' failed' : 'all passed'); if (fails) process.exit(1);
