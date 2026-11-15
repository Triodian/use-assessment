// Reads a matter brief exported from the AI Obligations Atlas (format triodian.matterBrief/1) for step B0.
// Shared by the browser (to load and show it) and the server (to check what is saved). Plain JavaScript.
// What is kept: the scope, the obligation references by tier, the questions counsel will need to determine, the
// dataset, its ledger position, each reference's applicability and the notices. The lawyer's matter label is not kept. Nothing here says what applies; counsel decides.

export const BRIEF_FORMAT = 'triodian.matterBrief/1';
const TIERS = [['binding', 'Binding'], ['expected', 'Expected'], ['anticipated', 'Anticipated']];
// A fourth list, present only when the lawyer loaded the client's Statement of Applicability in the Atlas (plan task ISO.8):
// the controls of a standard the client has adopted for itself, such as ISO/IEC 42001:2023 Annex A.
const ADOPTED = ['adopted', 'Adopted standard'];
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
// A state's records carry its ISO 3166-2 code (US-NY), as the Atlas files them. A state belongs to its country: a brief
// for New York is a brief for a United States company.
const US_STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const AU_STATES = { ACT: 'Australian Capital Territory', NSW: 'New South Wales', NT: 'Northern Territory', QLD: 'Queensland', SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia' };
export const countryOf = c => String(c || '').split('-')[0];
/** "New York (United States)" for US-NY; the name in names for a country; the code where neither is known. */
export function jurisdictionLabel(names, c) {
  const map = names || {}, code = String(c || '');
  if (map[code]) return map[code];
  const [k, s] = code.split('-');
  if (!s) return code;
  const sub = k === 'US' ? US_STATES[s] : k === 'AU' ? AU_STATES[s] : '';
  return `${sub || code} (${map[k] || k})`;
}
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
  const scope = [ets.length ? ets.map(c => n(names.entityTypes, c)).join(', ') : 'Any entity type', jur.length ? jur.map(c => jurisdictionLabel(names.jurisdictions, c)).join(', ') : 'All jurisdictions', ucs.length ? 'use cases ' + ucs.join(', ') : 'all use cases'].join(' · ');
  // Provenance kept with the brief (security review 15 Nov 2026, S.6): the sectors it was scoped to, the Atlas dataset
  // and ledger position it was built from, and each reference's structured applicability, so a decision recorded against
  // the brief can be traced back to the exact record that supported it.
  // scope.sectors: { regulatedSectorID, name } per the published brief schema (older briefs: none, or bare ids).
  const secs = Array.isArray(b.scope.sectors) ? b.scope.sectors.map(x => str(isObj(x) ? x.regulatedSectorID || x.sectorID || x.id : x, 40)).filter(Boolean) : [];
  const secNames = Array.isArray(b.scope.sectors) ? Object.fromEntries(b.scope.sectors.filter(isObj).map(x => [str(x.regulatedSectorID, 40), str(x.name, 120)]).filter(([k, v]) => k && v)) : {};
  const ds = isObj(b.dataset) ? b.dataset : {}, lh = isObj(ds.ledgerHead) ? ds.ledgerHead : {};
  const applicability = o => ({
    jurisdiction: str(o.jurisdiction, 8), appliesToAnyAIUse: o.appliesToAnyAIUse === true, useCaseIDs: Array.isArray(o.useCaseIDs) ? o.useCaseIDs.map(x => str(x, 8)).filter(Boolean).slice(0, 20) : [],
    keyDates: Array.isArray(o.keyDates) ? o.keyDates.filter(isObj).slice(0, 12).map(d => ({ dateType: str(d.dateType, 30), date: str(d.date, 10) })) : [],
    lastVerified: str(o.lastVerified, 10), governedRecordID: str(o.governedRecordID, 100), provenanceRef: str(o.provenanceRef, 100), publicationStatus: str(o.publicationStatus, 30),
    // An adopted-standard record carries the client's own Statement of Applicability row: whether the control applies,
    // why, and how far it is implemented. That is the client's justification, so it is kept word for word (bounded).
    ...(isObj(o.statementOfApplicability) ? { statementOfApplicability: { applicable: o.statementOfApplicability.applicable === true, justification: str(o.statementOfApplicability.justification, 1000), implementation: str(o.statementOfApplicability.implementation, 60) } } : {}),
  });
  const brief = {
    format: BRIEF_FORMAT, loadedOn, loadedBy, generatedAt: str(b.generatedAt, 40), scope: secs.length ? scope + ' · sectors ' + secs.join(', ') : scope,
    scopeCodes: { jurisdictions: jur.slice(0, 20), entityTypes: ets.slice(0, 20), useCases: ucs.slice(0, 20), sectors: secs.slice(0, 20) }, sectorNames: secNames,
    dataset: isObj(b.dataset) ? { name: str(ds.name, 80), generatedAt: str(ds.generatedAt, 40), preview: !!ds.preview, metamodelVersion: str(ds.metamodelVersion, 20), ledgerHead: { sequence: Number.isInteger(lh.sequence) ? lh.sequence : null, hash: /^[0-9a-f]{16,128}$/.test(lh.hash || '') ? lh.hash : '' } } : {},
    profile: isObj(b.profile) ? { profile: str(b.profile.profile, 40), mode: str(b.profile.mode, 40), reason: str(b.profile.reason, 400) } : null,
    tiers: tiers.map(([k, label]) => ({ tier: label, refs: b.obligationsByTier[k].slice(0, 200).map(o => [str(o.obligationID, 80), str(o.title, 300), str(o.instrument, 300), str(o.citation, 200), str(o.status, 40), /^https:\/\//.test(o.sourceURL || '') ? str(o.sourceURL, 500) : '', applicability(o)]) })),
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
  if (e.jurisdiction && jur.length && !jur.map(countryOf).includes(e.jurisdiction)) out.push(`The brief covers ${jur.map(c => jurisdictionLabel(names.jurisdictions, c)).join(', ')}; the company is in ${jurisdictionLabel(names.jurisdictions, e.jurisdiction)}.`);
  const ets = sc.entityTypes || [];
  if (e.entityType && ets.length && !ets.includes(e.entityType) && !ets.includes('anyOrganization')) out.push(`The brief covers ${ets.map(c => (names.entityTypes || {})[c] || c).join(', ')}; the company is a ${((names.entityTypes || {})[e.entityType] || e.entityType).toLowerCase()}.`);
  // The regulated sector too: a brief scoped to one sector's obligations says nothing about another's.
  const secs = sc.sectors || [], sn = c => ((brief && brief.sectorNames) || {})[c] || (names.sectors || {})[c] || c;
  if (e.sector && secs.length && !secs.includes(e.sector)) out.push(`The brief was scoped to ${secs.map(sn).join(', ')}; the engagement is in ${sn(e.sector)}.`);
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
