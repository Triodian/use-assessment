// Reads a matter brief exported from the AI Obligations Atlas (format triodian.matterBrief/1) for step B0.
// Shared by the browser (to load and show it) and the server (to check what is saved). Plain JavaScript.
// What is kept: the scope, the obligation references by tier, the questions counsel will need to determine, the
// dataset date and the notices. The lawyer's matter label is not kept. Nothing here says what applies; counsel decides.

export const BRIEF_FORMAT = 'triodian.matterBrief/1';
const TIERS = [['binding', 'Binding'], ['expected', 'Expected'], ['anticipated', 'Anticipated']];
// A fourth list, present only when the lawyer loaded the client's Statement of Applicability in the Atlas (plan task ISO.8):
// the controls of a standard the client has adopted for itself, such as ISO/IEC 42001:2023 Annex A.
const ADOPTED = ['adopted', 'Adopted standard'];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, n = 400) => typeof v === 'string' ? v.slice(0, n) : '';

/**
 * text: the file's text, or an already parsed object. names: { entityTypes: {code: name}, jurisdictions: {code: name} }.
 * Returns { error } with the reason, or { brief } in the form B0 stores.
 */
export function readBrief(text, names = {}, loadedOn = '', loadedBy = '') {
  let b = text;
  if (typeof text === 'string') { try { b = JSON.parse(text); } catch (e) { return { error: 'This file is not a matter brief: it is not valid JSON.' }; } }
  if (!isObj(b)) return { error: 'This file is not a matter brief.' };
  if (b.briefFormat !== BRIEF_FORMAT) return { error: b.briefFormat ? `This brief is in format ${String(b.briefFormat).slice(0, 40)}. This app reads ${BRIEF_FORMAT}. Export it again from the AI Obligations Atlas.` : 'This file is not a matter brief from the AI Obligations Atlas: it has no briefFormat.' };
  if (!isObj(b.scope) || !Array.isArray(b.scope.jurisdictions) || !Array.isArray(b.scope.entityTypes) || !Array.isArray(b.scope.useCases)) return { error: 'The brief has no scope (jurisdictions, entity types and use cases). Export it again from the AI Obligations Atlas.' };
  if (!isObj(b.obligationsByTier) || TIERS.some(([k]) => !Array.isArray(b.obligationsByTier[k]))) return { error: 'The brief has no obligations by tier (binding, expected and anticipated).' };
  if (b.obligationsByTier.adopted != null && !Array.isArray(b.obligationsByTier.adopted)) return { error: 'The adopted-standard references in the brief are not a list.' };
  const tiers = Array.isArray(b.obligationsByTier.adopted) ? TIERS.concat([ADOPTED]) : TIERS;
  for (const [k, label] of tiers) for (const [i, o] of b.obligationsByTier[k].entries()) {
    if (!isObj(o) || typeof o.obligationID !== 'string' || !o.obligationID || typeof o.title !== 'string') return { error: `Reference ${i + 1} under ${label} has no obligation ID or title.` };
  }
  if (b.questionsForCounsel != null && !Array.isArray(b.questionsForCounsel)) return { error: 'The questions for counsel in the brief are not a list.' };
  const n = (map, c) => (map && map[c]) || c;
  const jur = b.scope.jurisdictions.map(String), ets = b.scope.entityTypes.map(String), ucs = b.scope.useCases.filter(isObj).map(u => str(u.useCaseID, 8)).filter(Boolean);
  const scope = [ets.length ? ets.map(c => n(names.entityTypes, c)).join(', ') : 'Any entity type', jur.length ? jur.map(c => n(names.jurisdictions, c)).join(', ') : 'All jurisdictions', ucs.length ? 'use cases ' + ucs.join(', ') : 'all use cases'].join(' · ');
  const brief = {
    format: BRIEF_FORMAT, loadedOn, loadedBy, generatedAt: str(b.generatedAt, 40), scope,
    scopeCodes: { jurisdictions: jur.slice(0, 20), entityTypes: ets.slice(0, 20), useCases: ucs.slice(0, 20) },
    dataset: isObj(b.dataset) ? { generatedAt: str(b.dataset.generatedAt, 40), preview: !!b.dataset.preview } : {},
    tiers: tiers.map(([k, label]) => ({ tier: label, refs: b.obligationsByTier[k].slice(0, 200).map(o => [str(o.obligationID, 80), str(o.title, 300), str(o.instrument, 300), str(o.citation, 200), str(o.status, 40), /^https:\/\//.test(o.sourceURL || '') ? str(o.sourceURL, 500) : '']) })),
    questions: (b.questionsForCounsel || []).filter(q => isObj(q) && typeof q.question === 'string').slice(0, 60).map(q => ({ about: str(q.about, 80), question: str(q.question, 600) })),
    coverage: Array.isArray(b.coverage) ? b.coverage.filter(isObj).slice(0, 20).map(c => ({ jurisdiction: str(c.jurisdiction, 8), note: str(c.note, 400) })) : [],
    notices: Array.isArray(b.notices) ? b.notices.filter(x => typeof x === 'string').slice(0, 10).map(x => x.slice(0, 600)) : [],
  };
  return { brief };
}

/** Where the brief's scope differs from the engagement's company. Returns a list of plain sentences, empty when they agree. */
export function briefMismatch(brief, engagement, names = {}) {
  const out = [], sc = (brief && brief.scopeCodes) || {}, e = engagement || {};
  const jur = (sc.jurisdictions || []).filter(j => j !== 'INT');
  if (e.jurisdiction && jur.length && !jur.includes(e.jurisdiction)) out.push(`The brief covers ${jur.join(', ')}; the company is in ${(names.jurisdictions || {})[e.jurisdiction] || e.jurisdiction}.`);
  const ets = sc.entityTypes || [];
  if (e.entityType && ets.length && !ets.includes(e.entityType) && !ets.includes('anyOrganization')) out.push(`The brief covers ${ets.map(c => (names.entityTypes || {})[c] || c).join(', ')}; the company is a ${((names.entityTypes || {})[e.entityType] || e.entityType).toLowerCase()}.`);
  return out;
}

/** The shape a stored brief must have. '' when sound. */
export function storedBriefError(mb) {
  if (mb == null) return '';
  if (!isObj(mb)) return 'The matter brief is not valid.';
  if (mb.format && mb.format !== BRIEF_FORMAT) return 'The matter brief is not in a format this app reads.';
  if (!Array.isArray(mb.tiers) || mb.tiers.some(t => !isObj(t) || !Array.isArray(t.refs))) return 'The matter brief has no obligations by tier.';
  if (mb.questions != null && !Array.isArray(mb.questions)) return 'The matter brief’s questions are not a list.';
  return '';
}
