// The APRA letter evidence index (development plan task R.2): every output is tagged with a letter bullet and an
// ISO/IEC 42001 reference, and GET /api/evidence (and the service binding) lists the assessment's artefacts with
// their status. Run: node tests/evidence.test.mjs
import { assessmentEvidence } from '../lib/core/api.js';
import { LETTER, ISO, OBJECTIVES, ANNEX_A, TAGS, tagLine, indexMarkdown, assessmentArtefacts, appetiteArtefacts, soaReport, isoSummary, soaMarkdown, NOT_EVIDENCED } from '../public/shared/evidence.js';

let fails = 0; const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
const ids = new Set(LETTER.map(b => b.id)), iso = new Set(ISO.map(x => x[0])), objectives = new Set(OBJECTIVES.map(x => x[0]));
const bad = [];
for (const [app, outs] of Object.entries(TAGS)) for (const [id, t] of Object.entries(outs)) {
  if (!t.letter.length || t.letter.some(x => !ids.has(x))) bad.push(`${app}.${id} letter`);
  if (t.iso.some(x => !iso.has(x)) || (t.inputTo || []).some(x => !iso.has(x))) bad.push(`${app}.${id} iso`);   // a control, never an objective such as A.10
}
ok('every tag names a letter bullet, and only clauses and Annex A controls that exist', !bad.length, bad.join(', '));
ok('every letter bullet maps to ISO/IEC 42001 references that exist', LETTER.every(b => b.iso.length && b.iso.every(x => iso.has(x) || objectives.has(x))));
ok('the letter has its 19 bullets, B1 to A4', LETTER.length === 19 && LETTER[0].id === 'B1' && LETTER[18].id === 'A4');
ok('the tags of the dependency register name G3, P1, CPS 230 47(c) and A.10.3', /G3, P1/.test(tagLine('UA', 'DL1')) && /47\(c\)/.test(tagLine('UA', 'DL1')) && /A\.10\.3/.test(tagLine('UA', 'DL1')));
// Task ISO.2: nothing the suite produces is an AI system impact assessment, so nothing is tagged to A.5 or clause 6.1.4.
const all = Object.entries(TAGS).flatMap(([app, o]) => Object.entries(o).map(([id, t]) => [app + '.' + id, t]));
ok('no output is tagged to A.5 or clause 6.1.4', all.every(([, t]) => !t.iso.some(x => /^A\.5\b/.test(x) || x === '6.1.4')), all.filter(([, t]) => t.iso.some(x => /^A\.5\b/.test(x) || x === '6.1.4')).map(x => x[0]).join());
ok('AI Use Assessment is not an input to A.5 either', Object.values(TAGS.UA).every(t => !(t.inputTo || []).length));
ok('the evidence the assessment finds is tagged to suppliers, operation and monitoring, event logs and incident communication', ['A.10.3', 'A.6.2.6', 'A.6.2.8', 'A.8.4'].every(x => TAGS.UA.DL2.iso.includes(x)));
ok('the board’s goals are clause 6.2, its owners A.3.2, and its harm thresholds an input to A.5.2 only', ['6.2', 'A.3.2'].every(x => TAGS.BD.directions.iso.includes(x)) && TAGS.BD.directions.inputTo.join() === 'A.5.2' && TAGS.BD.statement.inputTo.join() === 'A.5.2');
ok('the review pack is not tagged as an internal audit', !TAGS.UA.RP.iso.includes('9.2'));
ok('Annex A has its 38 controls, A.2.2 to A.10.4, each once', ANNEX_A.length === 38 && new Set(ANNEX_A.map(x => x[0])).size === 38 && ANNEX_A[0][0] === 'A.2.2' && ANNEX_A[37][0] === 'A.10.4' && ANNEX_A.find(x => x[0] === 'A.6.2.4')[1] === 'AI system verification and validation' && ANNEX_A.find(x => x[0] === 'A.6.2.6')[1] === 'AI system operation and monitoring');

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
ok('each artefact carries its tags', by('DL1').letter.includes('G3') && by('DL1').iso.includes('A.10.3'));

const md = indexMarkdown({ artefacts: assessmentArtefacts(data, '2026-11-01'), by: 'letter', review: '2027-03-31', company: 'Coastline Super', gatheredOn: '2026-11-08' });
ok('by letter bullet: G3 lists the register', /## G3 [^\n]*\n\n[^\n]*\n\n\| App[^]*AI dependency register/.test(md));
ok('a bullet with no evidence says none yet', /## S3 [^\n]*\n\n[^\n]*\n\nNone yet\./.test(md));
ok('review dates follow the AI management review (clause 9.3)', md.includes('clause 9.3), 2027-03-31') && /\| 2026-10-20 \| 2027-03-31 \|/.test(md));
const mi = indexMarkdown({ artefacts: assessmentArtefacts(data, '2026-11-01'), by: 'iso', gatheredOn: '2026-11-08' });
ok('by ISO/IEC 42001 control: A.10.3 lists the register, with its letter bullets', /## A\.10\.3 · Suppliers\n\nLetter bullets: S4, P1, P2, P4\.[^]*?AI dependency register/.test(mi), (mi.match(/## A\.10\.3[^\n]*\n\n[^\n]*/) || [''])[0]);
const sec = id => { const i = mi.indexOf('## ' + id + ' '); return mi.slice(i, mi.indexOf('\n## ', i + 3)); };
ok('A.5.2 to A.5.5 show no entry from the assessment', ['A.5.2', 'A.5.3', 'A.5.4', 'A.5.5'].every(id => sec(id).includes(NOT_EVIDENCED) && !/AI Use Assessment/.test(sec(id))));
ok('a control the suite was never built for says so', sec('A.7.4').includes(NOT_EVIDENCED) && sec('A.6.2.4').includes(NOT_EVIDENCED));
// Task ISO.5: the Statement of Applicability is a list of controls. The index sets each one against the outputs.
const soa = [{ control: 'A.10.3', applicable: true, implemented: 'partly', justification: 'Material service providers' }, { control: 'A.5.2', applicable: true, implemented: 'partly', justification: 'Every arrangement at A3 or above' }, { control: 'A.8.2', applicable: false, implemented: '', justification: 'Members are not users of the AI systems' }];
const ms = indexMarkdown({ artefacts: assessmentArtefacts(data, '2026-11-01'), by: 'iso', gatheredOn: '2026-11-08', soa });
ok('with a Statement of Applicability, each control shows whether it applies and how far it is implemented', ms.includes('Statement of Applicability: applies · implemented in part · Material service providers') && ms.includes('Statement of Applicability: does not apply · Members are not users of the AI systems') && ms.includes('Statement of Applicability: not listed'));
const sum = isoSummary(assessmentArtefacts(data, '2026-11-01'), soa);
ok('it counts the applicable controls the outputs evidence and those they do not', sum.listed === 3 && sum.applicable === 2 && sum.evidenced === 1 && ms.includes('2 of 3 controls listed apply. Of those, the suite’s outputs evidence 1 and do not evidence 1.'), JSON.stringify(sum));
const rep5 = soaReport(assessmentArtefacts(data, '2026-11-01'), soa);
ok('the report has a row for each of the 38 controls', rep5.length === 38 && rep5.find(r => r.id === 'A.5.2').evidence.length === 0 && rep5.find(r => r.id === 'A.10.3').evidence.length > 0 && soaMarkdown(assessmentArtefacts(data, '2026-11-01'), soa).includes('| A.5.2 | AI system impact assessment process | applies · implemented in part · Every arrangement at A3 or above | Not evidenced by this suite |'));
// Lite scope (task R.3): the assessment's artefacts say what they cover, so the index does not read as the whole estate
const f5 = v => ({ 5: { value: v } });
const lite = { engagement: { insurer: 'Coastline Super', scope: 'lite' }, arrangements: [{ id: 'ARR-01' }, { id: 'ARR-02' }, { id: 'ARR-03' }],
  entries: [{ id: 'REG-001', arrangementId: 'ARR-01', fields: f5('Member services · critical operation: Benefit payments') }, { id: 'REG-002', arrangementId: 'ARR-02', fields: f5('Advice') }, { id: 'REG-003', arrangementId: 'ARR-03', fields: f5('Investments · critical operation: none') }],
  versions: [{ label: 'Set agreed (R1)', at: '2026-10-05T01:00:00Z' }], feedback: { generated: '2026-11-08T00:00:00Z' } };
const la = assessmentArtefacts(lite, '2026-11-01'), lby = id => la.find(a => a.id === id);
ok('Lite scope: the register says it covers the arrangements behind critical operations', lby('DL1').note === 'Not yet signed off: Counsel review recorded (R6) · Lite scope: 1 of 3 arrangements, those behind critical operations; 2 left out for later triage', lby('DL1').note);
ok('Lite scope: so do the findings issued in the feed', /Issued to AI Risk Appetite · Lite scope: 1 of 3/.test(lby('FN').note), lby('FN').note);
ok('Lite scope: not on the engagement plan, nor on an artefact with none yet', !/Lite/.test(lby('EP').note) && lby('DL3').note === '');
ok('Lite scope: the note reaches the index', /\| AI dependency register \|[^\n]*Lite scope: 1 of 3/.test(indexMarkdown({ artefacts: la, by: 'letter', gatheredOn: '2026-11-08' })));
{ const ra = minute => appetiteArtefacts({ calibration: { status: 'approved', approvedOn: '2026-12-02', minuteRef: minute } }, '2026-12-02').find(a => a.id === 'calibration').note;
  ok('a minute reference is prefixed with "minute" once', ra('2026/12-04') === 'Approved by the board, minute 2026/12-04' && ra('Board minute 2026/12-04') === 'Approved by the board, Board minute 2026/12-04', ra('Board minute 2026/12-04')); }
ok('full scope: no scope note', !assessmentArtefacts(data, '2026-11-01').some(a => /Lite scope/.test(a.note)));
ok('no "must" or "required" in the index', !/\b(must|required)\b/i.test(md + mi));
console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
