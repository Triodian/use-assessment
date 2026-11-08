// The in-use feed for AI Risk Appetite (development plan task 3.7): only a Triodian role issues it, the server keeps a
// register extract v2 only, and GET /api/appetite-feedback serves what was last issued. Run: node tests/feedback.test.mjs
import { checkSave } from '../lib/core/rbac.js';
import { issuedFeedback } from '../lib/core/api.js';

let fails = 0; const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
const users = [{ id: 'as', name: 'Ash', roles: ['assessor'], active: true }, { id: 'cn', name: 'Cass', roles: ['counsel'], active: true }];
const base = () => ({ schema: 'triodian.aua.v1', engagement: { id: 'e1', insurer: 'Acme' }, people: [], arrangements: [], entries: [], questions: [], findings: [], reviews: [], exceptions: [], independentReviewPoints: [], documents: [], interviews: [], versions: [], history: [] });
const feed = { schema: 'triodian.aua.extract.v2', generated: '2026-11-08T08:00:00Z', entries: [{ function: 'Claims', tier: 'A3', consequence: 'C4', received: 'E2' }], measures: [{ ref: 'M1', value: 0, basis: 'x' }], gapsByPriority: { High: 1, Medium: 0, Low: 0 }, overdue: [] };
const save = (who, f) => { const o = base(), n = JSON.parse(JSON.stringify(o)); f(n); return checkSave(o, n, users.find(u => u.id === who), users); };

ok('a Triodian role issues the feed', !save('as', n => { n.feedback = feed; }).error, save('as', n => { n.feedback = feed; }).error);
ok('counsel cannot', !!save('cn', n => { n.feedback = feed; }).error);
ok('a feed that is not an extract v2 is refused', save('as', n => { n.feedback = { schema: 'triodian.aua.extract.v1', entries: [] }; }).status === 400);
ok('before it is issued the API answers 404', (await issuedFeedback({ getEngagement: async () => ({ data: base() }) })).status === 404);
const r = await issuedFeedback({ getEngagement: async () => ({ data: { ...base(), feedback: feed } }) });
ok('after, it serves the feed as issued', r.status === 200 && r.body.schema === 'triodian.aua.extract.v2' && r.body.gapsByPriority.High === 1);
console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
