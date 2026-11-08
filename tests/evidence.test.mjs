// The APRA letter evidence index (development plan task R.2): every output is tagged with a letter bullet and an
// ISO/IEC 42001 reference, and GET /api/evidence (and the service binding) lists the assessment's artefacts with
// their status. Run: node tests/evidence.test.mjs
import { assessmentEvidence } from '../lib/core/api.js';
import { LETTER, ISO, TAGS, tagLine, indexMarkdown, assessmentArtefacts } from '../public/shared/evidence.js';

let fails = 0; const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
const ids = new Set(LETTER.map(b => b.id)), iso = new Set(ISO.map(x => x[0]));
const bad = [];
for (const [app, outs] of Object.entries(TAGS)) for (const [id, t] of Object.entries(outs)) {
  if (!t.letter.length || t.letter.some(x => !ids.has(x))) bad.push(`${app}.${id} letter`);
  if (!t.iso.length || t.iso.some(x => !iso.has(x))) bad.push(`${app}.${id} iso`);
}
ok('every tag names a letter bullet and an ISO/IEC 42001 reference that exist', !bad.length, bad.join(', '));
ok('every letter bullet maps to ISO/IEC 42001 references that exist', LETTER.every(b => b.iso.length && b.iso.every(x => iso.has(x))));
ok('the letter has its 19 bullets, B1 to A4', LETTER.length === 19 && LETTER[0].id === 'B1' && LETTER[18].id === 'A4');
ok('the tags of the dependency register name G3, P1, CPS 230 47(c) and A.5', /G3, P1/.test(tagLine('UA', 'DL1')) && /47\(c\)/.test(tagLine('UA', 'DL1')) && /A\.5/.test(tagLine('UA', 'DL1')));

const data = { engagement: { insurer: 'Coastline Super', reference: 'AUA-1' }, entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: { 3: { value: 'B1' } } }], questions: [{ status: 'answered', respondedOn: '2026-10-21' }],
  versions: [{ label: 'Set agreed (R1)', at: '2026-10-05T01:00:00Z' }, { label: 'Counsel review recorded (R6)', at: '2026-10-20T01:00:00Z' }] };
ok('with no assessment the list answers 404', (await assessmentEvidence({ getEngagement: async () => null })).status === 404);
const r = await assessmentEvidence({ getEngagement: async () => ({ data, updatedAt: '2026-11-01T00:00:00Z' }) });
const by = id => r.body.artefacts.find(a => a.id === id);
ok('the list answers 200 with the evidence format and the company', r.status === 200 && r.body.format === 'triodian.evidence.v1' && r.body.company === 'Coastline Super');
ok('the register is recorded at the counsel review (R6)', by('DL1').status === 'recorded' && by('DL1').asOf === '2026-10-20');
ok('outputs waiting on the independent check are draft', by('RP').status === 'draft' && by('CM').status === 'draft');
ok('no B3 entry, so the control-library shape has none yet', by('DL3').status === 'none');
ok('the findings are none yet until the in-use feed is issued', by('FN').status === 'none');
ok('each artefact carries its tags', by('DL1').letter.includes('G3') && by('DL1').iso.includes('A.10'));

const md = indexMarkdown({ artefacts: assessmentArtefacts(data, '2026-11-01'), by: 'letter', review: '2027-03-31', company: 'Coastline Super', gatheredOn: '2026-11-08' });
ok('by letter bullet: G3 lists the register', /## G3 [^\n]*\n\n[^\n]*\n\n\| App[^]*AI dependency register/.test(md));
ok('a bullet with no evidence says none yet', /## S3 [^\n]*\n\n[^\n]*\n\nNone yet\./.test(md));
ok('review dates follow the AI management review (clause 9.3)', md.includes('clause 9.3), 2027-03-31') && /\| 2026-10-20 \| 2027-03-31 \|/.test(md));
const mi = indexMarkdown({ artefacts: assessmentArtefacts(data, '2026-11-01'), by: 'iso', gatheredOn: '2026-11-08' });
ok('by ISO/IEC 42001 control: A.5 lists the register, with its letter bullets', /## A\.5 · Assessing impacts of AI systems\n\nLetter bullets: A4\.[^]*AI dependency register/.test(mi));
ok('no "must" or "required" in the index', !/\b(must|required)\b/i.test(md + mi));
console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
