// The hand-over (development plan tasks 7.4 part A and 7.5). Run: node tests/handover.test.mjs
import { handoverOnly, viewFor, applyHandover, independenceError, suppliers, mayDirect } from '../lib/core/handover.js';
import { checkSave, deny } from '../lib/core/rbac.js';
let fails = 0;
const ok = (label, cond) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label); };
const U = { cio: { id: 'cio', name: 'Imogen', roles: ['technologyOwner'] }, ag: { id: 'ag', name: 'Tobias', roles: ['aiGovernance'] }, counsel: { id: 'co', name: 'Meredith', roles: ['counsel'] },
  mo: { id: 'mo', name: 'Sam', roles: ['methodOwner'] }, owner: { id: 'ow', name: 'Ana', roles: ['owner'] }, ir: { id: 'ir', name: 'Lena', roles: ['ir'] }, both: { id: 'bo', name: 'Bo', roles: ['aiGovernance', 'owner'] },
  admin: { id: 'ad', name: 'Ada', roles: ['aiGovernance'], isAdmin: true } };
const users = Object.values(U).map(u => ({ ...u, active: true }));
const base = () => ({ schema: 'triodian.aua.v1', engagement: { id: 'e1', insurer: 'Corvane', reference: 'R-1', counselFirm: 'Askew Lane', privilegeMarking: 'Privileged', handBack: { by: '', on: '' }, independentReviewerReportsTo: 'counsel' },
  people: [], arrangements: [{ id: 'ARR-01', name: 'Claims manager' }], entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: { 15: { value: 'A3' } }, tierProposed: 'A3' }], questions: [{ ref: 'QC-01', question: 'Is this reach lawful?' }],
  findings: [{ arrangementId: 'ARR-01', type: 'F2' }], reviews: [], independentReviewPoints: [], history: [{ at: '1', action: 'classify' }], versions: [] });
const T = '2026-11-12';

// who sees the hand-over only
ok('a person with only the technology owner role sees the hand-over only', handoverOnly(U.cio) && handoverOnly(U.ag));
ok('a person who also holds another role, or an administrator, sees the assessment as that role does', !handoverOnly(U.both) && !handoverOnly(U.admin) && !handoverOnly(U.owner) && !handoverOnly({ id: 'x', roles: [] }));
const v = viewFor({ ...base(), handover: { items: [{ id: 'H1', kind: 'inventory', system: 'Triage model', suppliedBy: 'ag' }] } }, [{ id: 'ag', name: 'Tobias', organisation: 'Corvane', roles: ['aiGovernance'], email: 'x@y' }]);
ok('what they are sent holds no register, classification, question, finding, history or version', !('entries' in v) && !('questions' in v) && !('findings' in v) && !('history' in v) && !('versions' in v) && !('arrangements' in v) && !JSON.stringify(v).includes('A3') && !JSON.stringify(v).includes('lawful'));
ok('nor the privilege marking or anyone’s email address', !JSON.stringify(v).includes('Privileged') && !JSON.stringify(v).includes('x@y'));
ok('it holds the hand-over and the names of the people', v.handover.items.length === 1 && v.people[0].name === 'Tobias' && v.engagement.insurer === 'Corvane');

// supplying
let d = base();
const step = (body, user) => { const r = applyHandover(d, body, user, T); if (!r.error) d = { ...d, handover: r.handover }; return r; };
ok('counsel asks for the hand-over', !step({ action: 'request', note: 'Inventory and contracts by Friday' }, U.counsel).error && d.handover.request.by === 'co');
ok('the technology owner cannot ask for it', step({ action: 'request', note: 'x' }, U.cio).status === 403);
ok('the AI governance team adds an item', !step({ action: 'item', kind: 'inventory', system: 'Triage model at the claims manager', description: 'Routes motor claims', where: 'Inventory row 14' }, U.ag).error && d.handover.items[0].id === 'H1' && d.handover.items[0].suppliedBy === 'ag' && d.handover.items[0].suppliedOn === T);
ok('an item names what it is and what it is about', step({ action: 'item', kind: 'other', system: 'x' }, U.ag).status === 400 && step({ action: 'item', kind: 'evidence', system: ' ' }, U.ag).status === 400);
ok('the technology owner adds evidence and existing assurance', !step({ action: 'item', kind: 'evidence', system: 'Claims manager', description: 'Agreement', where: 'C-1182' }, U.cio).error && !step({ action: 'item', kind: 'assurance', system: 'Claims manager', description: 'Internal audit covers payments only' }, U.cio).error && d.handover.items.length === 3);
ok('an item can be changed while the hand-over is open; who supplied it stays', !step({ action: 'item', id: 'H1', kind: 'inventory', system: 'Triage model', description: 'Routes claims', where: 'Row 14' }, U.cio).error && d.handover.items[0].system === 'Triage model' && d.handover.items[0].suppliedBy === 'ag');
ok('an item can be removed while it is open', !step({ action: 'remove', id: 'H3' }, U.ag).error && d.handover.items.length === 2);
for (const who of ['counsel', 'mo', 'owner', 'ir']) ok(`${who} cannot add to the hand-over`, step({ action: 'item', kind: 'inventory', system: 'x' }, U[who]).status === 403);
ok('counsel cannot confirm it complete', step({ action: 'complete' }, U.counsel).status === 403);
ok('an empty hand-over cannot be confirmed complete', applyHandover(base(), { action: 'complete' }, U.cio, T).status === 400);
ok('the technology owner confirms it complete, in their own name', !step({ action: 'complete' }, U.cio).error && d.handover.complete.by === 'cio' && d.handover.complete.on === T);
// after it is complete, the two roles change nothing
ok('after that an item cannot be added', step({ action: 'item', kind: 'inventory', system: 'Late one' }, U.ag).status === 409);
ok('or changed', step({ action: 'item', id: 'H1', kind: 'inventory', system: 'Changed' }, U.cio).status === 409);
ok('or removed', step({ action: 'remove', id: 'H1' }, U.ag).status === 409);
ok('or confirmed again', step({ action: 'complete' }, U.ag).status === 409);
ok('the two roles cannot reopen it themselves', step({ action: 'reopen', reason: 'More to add' }, U.cio).status === 403);
ok('reopening needs a reason', step({ action: 'reopen', reason: ' ' }, U.counsel).status === 400);
ok('counsel reopens it with the reason, and an item can be added again', !step({ action: 'reopen', reason: 'Binder papers still to come' }, U.counsel).error && !d.handover.complete.by && !step({ action: 'item', kind: 'evidence', system: 'Binder', description: 'Renewal papers' }, U.ag).error);
ok('the record keeps every step, with who and when', d.handover.log.map(l => l.action).join() === 'request,add,add,add,change,remove,complete,reopen,add' && d.handover.log.every(l => l.by && l.on === T));
ok('the method owner and the delivery manager may also ask or reopen; an assessor may not', mayDirect(U.mo) && mayDirect({ roles: ['delivery'] }) && mayDirect({ roles: ['gc'] }) && !mayDirect({ roles: ['assessor'] }));

// an ordinary save cannot change the hand-over
const stored = { ...base(), handover: d.handover };
const sent = JSON.parse(JSON.stringify(stored)); sent.handover.items = []; sent.handover.complete = { by: 'mo', on: T }; sent.history.push({ at: '2', action: 't' });
const r = checkSave(stored, sent, U.mo, users);
ok('a save that changes the hand-over keeps the stored one', !r.error && JSON.stringify(r.data.handover) === JSON.stringify(stored.handover));
const none = base(); const sent2 = { ...JSON.parse(JSON.stringify(none)), handover: { items: [{ id: 'H1' }] } }; sent2.history.push({ at: '2', action: 't' });
const r2 = checkSave(none, sent2, U.mo, users);
ok('a save cannot create one either', !r2.error && !('handover' in r2.data));

// independence (task 7.5)
ok('the people who supplied or confirmed it are known, after a reopening too', [...suppliers(stored)].sort().join() === 'ag,cio');
ok('a person with a management role cannot be the independent reviewer', !!independenceError(base(), { id: 'x', roles: ['ir', 'aiGovernance'] }) && !!independenceError(base(), { id: 'x', roles: ['ir', 'technologyOwner'] }));
ok('nor can a person who supplied the hand-over, whatever role they hold now', !!independenceError(stored, { id: 'ag', roles: ['ir'] }));
ok('anyone else can', !independenceError(stored, { id: 'ir', roles: ['ir'] }));
ok('a supplier who was later given the reviewer role cannot confirm the independent check (R7)', /supplied or confirmed the hand-over/.test(deny('r7', { id: 'ag', roles: ['ir'] }, stored)) && /supplied or confirmed/.test(deny('irLog', { id: 'cio', roles: ['ir'] }, stored)));
ok('the independent reviewer still can', deny('irLog', U.ir, stored) === '');
const closedD = { ...stored, reviews: [{ point: 'R7', result: 'complete' }], engagement: { ...stored.engagement, handBack: { by: 'ow', on: T } } };
ok('a closed assessment takes no change to the hand-over', applyHandover(closedD, { action: 'reopen', reason: 'x' }, U.counsel, T).status === 403);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
