// The status the practice hub reads over a service binding (development plan task 4.1): stage, counts, roles and
// dates only, never names, arrangements, classifications or the wording of questions. Run: node tests/status.test.mjs
import { readFileSync } from 'node:fs';
import { engagementStatus, STATUS_FORMAT } from '../lib/core/status.js';
import { statusForService } from '../src/status.js';

let fails = 0;
const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
const KEYS = ['app', 'format', 'generated', 'lastActivity', 'nextBoardDate', 'nextSignOff', 'openActions', 'stage', 'waitingOn'];
const at = { today: '2026-11-10', now: '2026-11-10T00:00:00.000Z' };
const base = () => ({
  engagement: { insurer: 'Corvane General Insurance (fictional)', privilegeMarking: 'Privileged and confidential', briefConfirmed: { by: 'p2', on: '2026-10-09' }, documentsRequestedOn: '2026-10-09', gcActsAsCounsel: false, annexSigned: { by: '' }, handBack: { by: '' } },
  people: [{ id: 'p2', name: 'Priya Raman', roles: ['gc'] }],
  arrangements: [{ id: 'AR-01', provider: 'Claimsight Pty Ltd' }],
  setAgreed: { gcBy: 'p2', counselBy: '' },
  entries: [{ id: 'E-01', arrangementId: 'AR-01', fields: { 16: { value: 'C3' } }, consequenceConfirmedBy: '' }, { id: 'E-02', arrangementId: 'AR-01', fields: { 16: { value: 'C2' } }, consequenceConfirmedBy: 'p5' }],
  questions: [{ ref: 'Q-01', question: 'Does the contract allow audit of the model?', status: 'open' }],
  reviews: [], independentReviewPoints: [],
});

let s = engagementStatus(null, at);
ok('no engagement: not started', s.format === STATUS_FORMAT && s.app === 'use-assessment' && s.stage.step === 0 && s.stage.steps === 8 && s.openActions === 0);

s = engagementStatus({ data: base(), updatedAt: '2026-11-09T03:00:00Z' }, at);
ok('only the contract fields', JSON.stringify(Object.keys(s).sort()) === JSON.stringify(KEYS), Object.keys(s).join());
ok('set-up done, set not yet agreed by counsel: gate 2', s.stage.step === 2 && s.stage.label === 'The representative set (R1)', JSON.stringify(s.stage));
ok('waits on counsel (R1 and the question) and one business owner', JSON.stringify(s.waitingOn) === '[{"role":"Counsel","actions":2},{"role":"Business owners","actions":1}]' && s.openActions === 3, JSON.stringify(s.waitingOn));
ok('next sign-off: the set (R1)', s.nextSignOff.label === 'The GC and counsel agree the set (R1)' && s.lastActivity === '2026-11-09');
const text = JSON.stringify(s), leaks = ['Corvane', 'Priya', 'Claimsight', 'AR-01', 'C3', 'audit of the model'].filter(w => text.includes(w));
ok('no company, names, providers, arrangements, classifications or questions', !leaks.length, leaks.join(' | '));

const gc = base(); gc.engagement.gcActsAsCounsel = true;
s = engagementStatus({ data: gc }, at);
ok('GC acts as counsel: the second approver gives the second agreement', s.waitingOn.some(w => w.role === 'Second approver' && w.actions === 1) && /second approver/.test(s.nextSignOff.label), JSON.stringify(s.waitingOn));

const late = base(); late.setAgreed.counselBy = 'p3'; late.questions[0].status = 'answered';
late.reviews = [{ point: 'R2', result: 'passed' }, { point: 'R4', result: 'passed' }, { point: 'R6', on: '2026-11-08' }];
late.independentReviewPoints = [{ ref: 'IR-1', status: 'open', response: '' }, { ref: 'IR-2', status: 'open', response: 'Responded' }];
s = engagementStatus({ data: late }, at);
ok('after counsel review: the independent check is the stage', s.stage.step === 7 && s.stage.label === 'The independent check (R7)', JSON.stringify(s.stage));
ok('review points, the annex and the hand-back wait on their roles', JSON.stringify(s.waitingOn) === '[{"role":"Business owners","actions":2},{"role":"Triodian","actions":1},{"role":"Independent reviewer","actions":1},{"role":"Method owner","actions":1}]', JSON.stringify(s.waitingOn));
late.reviews.push({ point: 'R7', result: 'complete' }); late.engagement.handBack.by = 'p5'; late.engagement.annexSigned.by = 'p1'; late.independentReviewPoints = []; late.entries[0].consequenceConfirmedBy = 'p5';
s = engagementStatus({ data: late }, at);
ok('hand-back accepted: complete, nothing left', s.stage.step === 8 && /Complete/.test(s.stage.label) && s.nextSignOff === null && s.openActions === 0, JSON.stringify(s));

const dbWith = data => { const stmt = () => ({ bind() { return this; }, first: async () => data ? ({ revision: 3, data: JSON.stringify(data), updated_at: '2026-11-09T05:00:00Z', updated_by: 'y' }) : null, all: async () => ({ results: [] }), run: async () => ({ meta: {} }) }); return { prepare: stmt, batch: async () => [], exec: async () => ({}) }; };
s = await statusForService({ DB: dbWith(base()) }, new Date('2026-11-10T00:00:00Z'));
ok('statusForService reads the stored engagement', s.stage.step === 2 && s.lastActivity === '2026-11-09');
const fresh = { prepare: () => ({ bind() { return this; }, first: async () => { throw new Error('D1_ERROR: no such table: engagement: SQLITE_ERROR'); }, all: async () => { throw new Error('D1_ERROR: no such table: users: SQLITE_ERROR'); } }) };
s = await statusForService({ DB: fresh }, new Date('2026-11-10T00:00:00Z'));
ok('a deployment nobody has opened (no tables yet): not started', s.stage.step === 0 && s.stage.label === 'Not started', JSON.stringify(s.stage));
let threw = false; try { await statusForService({}); } catch (e) { threw = true; }
ok('no database: it throws, so the hub shows the app as unreachable', threw);

const idx = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8'), svc = readFileSync(new URL('../src/status-service.js', import.meta.url), 'utf8');
ok('src/index.js exports StatusService', /export \{ StatusService \} from '\.\/status-service\.js'/.test(idx));
ok('StatusService offers status() only', (svc.match(/async \w+\(/g) || []).join() === 'async status(' && /class StatusService extends WorkerEntrypoint/.test(svc));
console.log(fails ? `\n${fails} failed` : '\nAll passed'); process.exit(fails ? 1 : 0);
