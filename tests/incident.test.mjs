// AI Incident Accountability, Shape A (development plan tasks A.2 to A.6): the server-side rules for incident readiness,
// exercises and incidents (validation events) and the evidence-preservation holds, and the evidence index rows.
// Run: node tests/incident.test.mjs
import { checkSave, structureError } from '../lib/core/rbac.js';
import { assessmentArtefacts, tagLine, readinessDone, holdersOf } from '../public/shared/evidence.js';

let fails = 0; const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
const users = [
  { id: 'mo', name: 'Mo', roles: ['methodOwner'], active: true }, { id: 'as', name: 'Ash', roles: ['assessor'], active: true }, { id: 'cn', name: 'Cass', roles: ['counsel'], active: true },
  { id: 'gc', name: 'Gil', roles: ['gc'], active: true }, { id: 'ow', name: 'Owen', roles: ['owner'], active: true }, { id: 'cro', name: 'Cris', roles: ['cro'], active: true },
  { id: 'ir', name: 'Ira', roles: ['ir'], active: true }, { id: 'both', name: 'Both', roles: ['cro', 'ir'], active: true }, { id: 'pe', name: 'Pat', roles: ['peer'], active: true },
];
const u = id => users.find(x => x.id === id);
const entry = (id, readiness) => ({ id, arrangementId: 'ARR-01', fields: {}, authorityTests: [0, 0, 0, 0].map(() => ({ answer: null, source: '' })), tierProposed: '', tierOverrideReason: '', classifiedBy: '', reviewedBy: '', consequenceConfirmedBy: '', consequenceConfirmedOn: '', obtainability: { start: '', rungs: {} }, confChosen: '', confRaiseReason: '', peerReview: { personId: '', tier: '', differs: false, resolution: '', on: '' }, notDeterminable: { on: false, question: '', who: '', since: '' }, dl3Rows: [], readiness: readiness || {} });
const base = () => ({ schema: 'triodian.aua.v1', engagement: { id: 'e1', insurer: 'Acme' }, people: [], arrangements: [{ id: 'ARR-01', name: 'Claims', parties: 'TPA', boundaries: ['B1'] }], entries: [entry('REG-001')], questions: [], findings: [], reviews: [], exceptions: [], independentReviewPoints: [], documents: [], interviews: [], versions: [], history: [], exercises: [], holds: {} });
const ex = (extra) => ({ ref: 'VE-01', kind: 'exercise', title: 'Tabletop', date: '2026-12-18', awareAt: '2026-12-18T16:30', infrastructure: 'gateway', entryIds: ['REG-001'], unknowns: '', parties: [], tolerances: {}, triggers: {}, breachAssertedBy: '', breachAssertedOn: '', clocks: {}, clocksConfirmedBy: '', clocksConfirmedOn: '', line: '', speaker: '', lineSettledBy: '', lineSettledOn: '', seams: '', finding: '', recordsTime: '', exposure: '', actions: '', recordedBy: '', recordedOn: '', reviewedBy: '', reviewedOn: '', reviewNote: '', ...(extra || {}) });
const save = (who, o, f) => { const n = JSON.parse(JSON.stringify(o)); f(n); return checkSave(o, n, u(who), users); };
const fresh = (who, f) => { const n = base(); f(n); return checkSave(null, n, u(who), users); };

console.log('-- readiness fields (A.2)');
const RD = { infrastructure: 'gateway', records: 'action log', holderKind: 'vendor', holder: 'Vendor Pty Ltd', clause: 'cl.18', production: '5 business days', farSystem: 'A', farInfrastructure: 'B', farChange: 'C' };
ok('an assessor records readiness on an entry', !save('as', base(), n => { n.entries[0].readiness = RD; }).error);
ok('the arrangement owner cannot', save('ow', base(), n => { n.entries[0].readiness = RD; }).status === 403);
ok('readiness that is not an object is refused with a 400', save('as', base(), n => { n.entries[0].readiness = ['x']; }).status === 400);
ok('readinessDone needs every field', readinessDone({ readiness: RD }) && !readinessDone({ readiness: { ...RD, farChange: '' } }));
ok('holdersOf keys the record holders', JSON.stringify(holdersOf([{ readiness: RD }, { readiness: { holder: 'Vendor Pty Ltd' } }, { readiness: {} }])) === JSON.stringify(['vendor_pty_ltd']));

console.log('-- exercises and incidents (A.5)');
for (const who of ['as', 'mo', 'cro', 'ow', 'gc', 'cn']) ok(`${who} records an exercise`, !save(who, base(), n => { n.exercises.push(ex({ recordedBy: who })); }).error, save(who, base(), n => { n.exercises.push(ex({ recordedBy: who })); }).error);
ok('the independent reviewer cannot record one', save('ir', base(), n => { n.exercises.push(ex()); }).status === 403);
ok('recorded in your own name only', save('as', base(), n => { n.exercises.push(ex({ recordedBy: 'mo' })); }).status === 403);
const withEx = () => { const o = base(); o.exercises.push(ex({ recordedBy: 'as' })); return o; };
ok('the CRO asserts the tolerance and trigger test', !save('cro', withEx(), n => { n.exercises[0].tolerances = { c4: { result: 'notBreached', note: 'x' } }; n.exercises[0].breachAssertedBy = 'cro'; n.exercises[0].breachAssertedOn = '2026-12-18'; }).error);
ok('not in someone else’s name', save('cro', withEx(), n => { n.exercises[0].tolerances = { c4: { result: 'notBreached' } }; n.exercises[0].breachAssertedBy = 'ow'; }).status === 403);
ok('counsel settles the line', !save('cn', withEx(), n => { n.exercises[0].lineSettledBy = 'cn'; n.exercises[0].lineSettledOn = '2026-12-18'; }).error);
ok('an assessor cannot settle the line', save('as', withEx(), n => { n.exercises[0].lineSettledBy = 'as'; n.exercises[0].lineSettledOn = '2026-12-18'; }).status === 403);
ok('the GC confirms the clocks', !save('gc', withEx(), n => { n.exercises[0].clocksConfirmedBy = 'gc'; n.exercises[0].clocksConfirmedOn = '2026-12-18'; }).error);
ok('counsel cannot confirm the clocks', save('cn', withEx(), n => { n.exercises[0].clocksConfirmedBy = 'cn'; n.exercises[0].clocksConfirmedOn = '2026-12-18'; }).status === 403);
const asserted = () => { const o = withEx(); Object.assign(o.exercises[0], { tolerances: { c4: { result: 'notBreached', note: 'x' } }, breachAssertedBy: 'both', breachAssertedOn: '2026-12-18' }); return o; };
ok('the independent reviewer reviews the event', !save('ir', asserted(), n => { n.exercises[0].reviewedBy = 'ir'; n.exercises[0].reviewedOn = '2026-12-22'; }).error);
ok('not the person who asserted the test, even holding the ir role', save('both', asserted(), n => { n.exercises[0].reviewedBy = 'both'; n.exercises[0].reviewedOn = '2026-12-22'; }).status === 403, save('both', asserted(), n => { n.exercises[0].reviewedBy = 'both'; }).error);
ok('the CRO cannot review', save('cro', asserted(), n => { n.exercises[0].reviewedBy = 'cro'; n.exercises[0].reviewedOn = '2026-12-22'; }).status === 403);
const reviewed = () => { const o = asserted(); Object.assign(o.exercises[0], { reviewedBy: 'ir', reviewedOn: '2026-12-22' }); return o; };
ok('once reviewed, the test cannot change', save('cro', reviewed(), n => { n.exercises[0].tolerances.c4.result = 'breached'; }).status === 403);
ok('but the finding still can', !save('cro', reviewed(), n => { n.exercises[0].finding = 'The cause was the configuration push.'; }).error);
ok('only the method owner changes who asserted the test', save('cro', asserted(), n => { n.exercises[0].breachAssertedBy = ''; }).status === 403 && !save('mo', asserted(), n => { n.exercises[0].breachAssertedBy = ''; }).error);
ok('an exercise arriving on the first save with an attestation is refused', fresh('mo', n => { n.exercises.push(ex({ recordedBy: 'mo', lineSettledBy: 'cn', lineSettledOn: '2026-12-18' })); }).status === 403);
ok('an exercise without a ref is refused with a 400', save('as', base(), n => { n.exercises.push({ ...ex(), ref: '' }); }).status === 400);
ok('entryIds that are not a list are refused with a 400', structureError({ ...base(), exercises: [ex({ entryIds: 'REG-001' })] }) !== '');

console.log('-- evidence-preservation holds (A.4)');
const withHolder = () => { const o = base(); o.entries[0].readiness = RD; return o; };
const K = 'vendor_pty_ltd';
ok('an assessor drafts the addressee and note', !save('as', withHolder(), n => { n.holds[K] = { addressee: 'General counsel', note: 'Please include change tickets.' }; }).error);
ok('counsel drafts too', !save('cn', withHolder(), n => { n.holds[K] = { addressee: 'General counsel' }; }).error);
ok('the arrangement owner cannot draft', save('ow', withHolder(), n => { n.holds[K] = { addressee: 'x' }; }).status === 403);
ok('counsel marks it settled', !save('cn', withHolder(), n => { n.holds[K] = { settledBy: 'cn', settledOn: '2026-12-19' }; }).error);
ok('in their own name only', save('cn', withHolder(), n => { n.holds[K] = { settledBy: 'mo', settledOn: '2026-12-19' }; }).status === 403);
ok('an assessor cannot mark it settled', save('as', withHolder(), n => { n.holds[K] = { settledBy: 'as', settledOn: '2026-12-19' }; }).status === 403);
const settled = () => { const o = withHolder(); o.holds[K] = { addressee: 'GC', note: '', settledBy: 'cn', settledOn: '2026-12-19' }; return o; };
ok('once settled, the draft cannot change', save('as', settled(), n => { n.holds[K].note = 'changed'; }).status === 403);
ok('holds that are not an object are refused with a 400', save('cn', withHolder(), n => { n.holds = []; }).status === 400);
ok('a hold arriving on the first save already settled is refused', fresh('mo', n => { n.entries[0].readiness = RD; n.holds[K] = { settledBy: 'cn', settledOn: '2026-12-19' }; }).status === 403);

console.log('-- the evidence index (A.3)');
const A = d => Object.fromEntries(assessmentArtefacts(d, '2026-12-18T00:00:00Z').map(a => [a.id, a]));
let d = base(); ok('with readiness gaps DL11 is a draft that counts them', A(d).DL11.status === 'draft' && /1 of 1/.test(A(d).DL11.note));
d = withHolder(); ok('with readiness complete DL11 is recorded', A(d).DL11.status === 'recorded');
ok('DL12 is none until a holder is named, then a draft, then recorded when counsel has settled every letter', A(base()).DL12.status === 'none' && A(withHolder()).DL12.status === 'draft' && A(settled()).DL12.status === 'recorded');
ok('VE is none, then a draft, then recorded once every event is reviewed', A(base()).VE.status === 'none' && A(withEx()).VE.status === 'draft' && A(reviewed()).VE.status === 'recorded');
ok('the three outputs carry their letter bullets and controls', /APRA letter S1, G2, P2 · CPS 230 33, 42, 54 · ISO\/IEC 42001 A\.3\.2/.test(tagLine('UA', 'DL11')) && /CPS 230 54/.test(tagLine('UA', 'DL12')) && /A\.8\.4/.test(tagLine('UA', 'VE')));
ok('outside Australia they carry ISO/IEC 42001 (and the regime) only', !/APRA/.test(tagLine('UA', 'DL11', 'US', 'usBanking')) && /ISO\/IEC 42001/.test(tagLine('UA', 'DL11', 'US', 'usBanking')));

console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
