// Updates and consultation after the hand-over (development plan task 7.4, part B). Run: node tests/liaison.test.mjs
import { applyLiaison, mayRelease, mayDecide, openItems } from '../lib/core/liaison.js';
import { viewFor } from '../lib/core/handover.js';
import { checkSave } from '../lib/core/rbac.js';
import { eventsFromExchange } from '../lib/core/notify.js';
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label); };
const U = { cio: { id: 'cio', name: 'Imogen', roles: ['technologyOwner'] }, ag: { id: 'ag', name: 'Tobias', roles: ['aiGovernance'] }, counsel: { id: 'co', name: 'Meredith', roles: ['counsel'] }, gc: { id: 'gc', name: 'Helen', roles: ['gc'] },
  mo: { id: 'mo', name: 'Sam', roles: ['methodOwner'] }, assessor: { id: 'as', name: 'Jordan', roles: ['assessor'] }, delivery: { id: 'dm', name: 'Kit', roles: ['delivery'] }, owner: { id: 'ow', name: 'Ana', roles: ['owner'] }, ir: { id: 'ir', name: 'Lena', roles: ['ir'] } };
const users = Object.values(U).map(u => ({ ...u, active: true, email: u.id + '@x.test' }));
const base = () => ({ schema: 'triodian.aua.v1', engagement: { id: 'e1', insurer: 'Corvane', handBack: { by: '', on: '' }, independentReviewerReportsTo: 'counsel' }, people: [], arrangements: [{ id: 'ARR-01', name: 'Claims manager' }],
  entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: { 15: { value: 'A3' }, 23: { value: 'Counsel: the audit right does not reach the model' } }, tierProposed: 'A3', classifiedBy: 'as' }],
  questions: [{ ref: 'QC-01', question: 'Does the audit right reach the model?', response: 'No.' }], findings: [], reviews: [], independentReviewPoints: [], history: [], versions: [] });
const row = { entryId: 'REG-001', arrangement: 'Claims manager', system: 'Triage model', tier: 'A3 Decides', consequence: 'C3', indicativeRung: 'E3', obtainableRung: 'E2', confidence: 'medium', missing: ['Human involvement'],
  legal: [{ label: 'Nexus, relationship and location determination', value: 'Counsel: the audit right does not reach the model' }], secret: 'not a field' };
const T = '2026-11-12';
let d = base();
const step = (body, user) => { const r = applyLiaison(d, body, user, T); if (!r.error) d = { ...d, liaison: r.liaison }; return r; };
const seen = () => JSON.stringify(viewFor(d, []));

// ---- updates: only counsel releases; no legal determination unless counsel includes it
ok('before anything is released the two roles are sent no update', viewFor(d, []).liaison.updates.length === 0 && !seen().includes('A3'));
for (const who of ['mo', 'assessor', 'delivery', 'gc', 'cio', 'ag', 'owner', 'ir']) ok(`${who} cannot release an update`, step({ action: 'release', stage: 'End of phase 3', rows: [row] }, U[who]).status === 403);
ok('an update names its stage', step({ action: 'release', rows: [row] }, U.counsel).status === 400);
let r = step({ action: 'release', stage: 'End of phase 3 · Classify and test', note: 'As classified.', rows: [row] }, U.counsel);
ok('counsel releases an update', !r.error && d.liaison.updates[0].id === 'U1' && d.liaison.updates[0].releasedBy === 'co' && d.liaison.updates[0].releasedOn === T && r.notify === 'management');
ok('by default it carries no legal determination, even when the browser sent one', d.liaison.updates[0].includeLegal === false && !('legal' in d.liaison.updates[0].rows[0]) && !seen().includes('audit right'));
ok('it carries the technical position and where evidence is not yet known', seen().includes('A3 Decides') && seen().includes('Human involvement') && seen().includes('E2'));
ok('nothing but the named fields is kept', !seen().includes('not a field'));
ok('the two roles are sent what was released and nothing else of the assessment', !('entries' in viewFor(d, [])) && !('questions' in viewFor(d, [])) && !seen().includes('QC-01') && !seen().includes('classifiedBy'));
r = step({ action: 'release', stage: 'End of phase 5 · Findings', includeLegal: true, rows: [row] }, U.counsel);
ok('counsel can choose to include the determinations in a later update', !r.error && d.liaison.updates[1].includeLegal === true && d.liaison.updates[1].rows[0].legal[0].value.includes('audit right') && seen().includes('audit right'));
ok('the earlier update still carries none', !('legal' in d.liaison.updates[0].rows[0]));
ok('the GC releases only where set-up says the GC also acts as counsel', !mayRelease(U.gc, base()) && mayRelease(U.gc, { engagement: { gcActsAsCounsel: true } }) && mayRelease(U.counsel, base()));

// ---- a contested point
ok('counsel, an assessor and the owner cannot contest', ['counsel', 'assessor', 'owner'].every(w => step({ action: 'contest', updateId: 'U1', entryId: 'REG-001', reason: 'x', evidence: 'y' }, U[w]).status === 403));
ok('a point is contested on a released update', step({ action: 'contest', updateId: 'U9', entryId: 'REG-001', reason: 'x', evidence: 'y' }, U.ag).status === 404 && step({ action: 'contest', updateId: 'U1', entryId: 'REG-404', reason: 'x', evidence: 'y' }, U.ag).status === 404);
ok('with its reason and its evidence', step({ action: 'contest', updateId: 'U1', entryId: 'REG-001', reason: ' ', evidence: 'y' }, U.ag).status === 400 && step({ action: 'contest', updateId: 'U1', entryId: 'REG-001', reason: 'x', evidence: '' }, U.ag).status === 400);
const before = JSON.stringify(d.entries);
r = step({ action: 'contest', updateId: 'U1', entryId: 'REG-001', reason: 'A handler confirms each route, so the tier is lower.', evidence: 'Procedure CP-14 s.3, claims team' }, U.ag);
ok('the AI governance team contests a point', !r.error && d.liaison.contests[0].id === 'C1' && d.liaison.contests[0].by === 'ag' && d.liaison.contests[0].status === 'open' && r.notify === 'assessors');
ok('a contested point changes nothing in the register', JSON.stringify(d.entries) === before);
ok('the two roles, counsel and the GC cannot answer it', ['ag', 'cio', 'counsel', 'gc', 'delivery'].every(w => step({ action: 'decide', id: 'C1', outcome: 'accepted', decision: 'ok' }, U[w]).status === 403) && !mayDecide(U.counsel) && mayDecide(U.mo));
ok('the answer says what is revised or why the position is kept', step({ action: 'decide', id: 'C1', outcome: 'kept', decision: ' ' }, U.assessor).status === 400 && step({ action: 'decide', id: 'C1', outcome: 'maybe', decision: 'x' }, U.assessor).status === 400);
r = step({ action: 'decide', id: 'C1', outcome: 'kept', decision: 'CP-14 covers complex claims only.' }, U.assessor);
ok('the assessor keeps the position and says why', !r.error && d.liaison.contests[0].status === 'kept' && d.liaison.contests[0].decidedBy === 'as' && d.liaison.contests[0].decidedOn === T && r.notify === 'management');
ok('an answered point is not answered again', step({ action: 'decide', id: 'C1', outcome: 'accepted', decision: 'x' }, U.mo).status === 409);
step({ action: 'contest', updateId: 'U1', entryId: 'REG-001', reason: 'Second point', evidence: 'Log extract' }, U.cio);
ok('the technology owner contests one too, and the method owner accepts it', !step({ action: 'decide', id: 'C2', outcome: 'accepted', decision: 'Tier revised to A2 on the log extract.' }, U.mo).error && d.liaison.contests[1].status === 'accepted');
ok('even an accepted point leaves the register as it was: the assessor revises it by an ordinary, checked save', JSON.stringify(d.entries) === before);
ok('both points, with their answers, are what the two roles and the independent reviewer read', seen().includes('CP-14 covers complex claims only.') && d.liaison.contests.length === 2);

// ---- a consultation
ok('counsel cannot ask for one on their behalf', step({ action: 'askConsultation', topic: 'x' }, U.counsel).status === 403);
r = step({ action: 'askConsultation', topic: 'How the obtainable rung was reached' }, U.cio);
ok('the technology owner asks for a consultation', !r.error && d.liaison.consultations[0].id === 'S1' && !d.liaison.consultations[0].heldOn && r.notify === 'directors');
ok('the two roles cannot record it as held', step({ action: 'holdConsultation', id: 'S1', heldOn: T, outcome: 'x' }, U.cio).status === 403);
ok('it is recorded with its date and its outcome', step({ action: 'holdConsultation', id: 'S1', heldOn: 'soon', outcome: 'x' }, U.delivery).status === 400 && step({ action: 'holdConsultation', id: 'S1', heldOn: T, outcome: '' }, U.delivery).status === 400);
ok('the delivery manager records it as held', !step({ action: 'holdConsultation', id: 'S1', heldOn: T, outcome: 'Walked through the five tests.' }, U.delivery).error && d.liaison.consultations[0].heldOn === T && d.liaison.consultations[0].recordedBy === 'dm');

// ---- a structured review: named facts only
ok('only counsel asks for facts to be confirmed', ['mo', 'assessor', 'cio', 'gc'].every(w => step({ action: 'askReview', facts: ['x'] }, U[w]).status === 403) && step({ action: 'askReview', facts: [' '] }, U.counsel).status === 400);
r = step({ action: 'askReview', facts: ['The model runs in Australia.', '', 'Staff cannot change its settings.'] }, U.counsel);
ok('counsel names the facts', !r.error && d.liaison.reviews[0].facts.map(f => f.id).join() === 'F1.1,F1.2' && r.notify === 'management');
ok('they see those facts and nothing more', seen().includes('The model runs in Australia.') && !seen().includes('QC-01'));
ok('counsel cannot answer them', step({ action: 'answerFact', id: 'F1.1', answer: 'correct' }, U.counsel).status === 403);
ok('a fact that is not correct carries its correction', step({ action: 'answerFact', id: 'F1.2', answer: 'incorrect' }, U.ag).status === 400);
ok('the technology owner confirms one and the team corrects the other', !step({ action: 'answerFact', id: 'F1.1', answer: 'correct' }, U.cio).error && !step({ action: 'answerFact', id: 'F1.2', answer: 'incorrect', correction: 'Two people can change the thresholds.' }, U.ag).error && d.liaison.reviews[0].facts[1].correction.includes('thresholds') && d.liaison.reviews[0].facts[0].answeredBy === 'cio');
ok('an answered fact is not answered again', step({ action: 'answerFact', id: 'F1.1', answer: 'incorrect', correction: 'x' }, U.ag).status === 409);
ok('nothing is left waiting', (o => !o.contests.length && !o.consultations.length && !o.facts.length)(openItems(d)));

// ---- the record cannot be changed by an ordinary save, and a closed assessment takes no change
const sent = JSON.parse(JSON.stringify(d)); sent.liaison.updates = []; sent.liaison.contests[0].status = 'accepted'; sent.history.push({ at: '2', action: 't' });
const s1 = checkSave(d, sent, U.mo, users);
ok('a save that changes the record keeps the stored one', !s1.error && JSON.stringify(s1.data.liaison) === JSON.stringify(d.liaison));
const s2 = checkSave(base(), { ...base(), liaison: { updates: [{ id: 'U1' }] }, history: [{ at: '2', action: 't' }] }, U.mo, users);
ok('a save cannot create one', !s2.error && !('liaison' in s2.data));
const closedD = { ...d, reviews: [{ point: 'R7', result: 'complete' }], engagement: { ...d.engagement, handBack: { by: 'ow', on: T } } };
ok('a closed assessment takes no change', applyLiaison(closedD, { action: 'askConsultation', topic: 'x' }, U.cio, T).status === 403);

// ---- emails say what happened, never the content
const ev = eventsFromExchange('liaison.release', 'management', d, users, U.counsel, 'https://x');
ok('a released update is told to the two roles', ev.map(m => m.to.id).sort().join() === 'ag,cio' && /An update is released/.test(ev[0].subject));
ok('the email carries none of the update', !ev.some(m => /A3|Triage|E2|audit right/.test(m.text)));
ok('a contested point is told to the assessors, an answered fact to counsel', eventsFromExchange('liaison.contest', 'assessors', d, users, U.ag, 'https://x').map(m => m.to.id).sort().join() === 'as,mo' && eventsFromExchange('liaison.answerFact', 'counsel', d, users, U.ag, 'https://x').map(m => m.to.id).join() === 'co');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
