// Blind re-derivation (R3), enforced on the server.
// Until a peer reviewer records their own tier for an entry, the server does not send them the classifier's
// work on it: the tier and every later field, who classified it, the authority tests, the obtainability work,
// and the values in the change history and in kept versions. When they save, the withheld values are put
// back from the stored assessment, so their save cannot change or lose them.

const HIDDEN_KEYS = ['tierProposed', 'tierOverrideReason', 'authorityTests', 'classifiedBy', 'reviewedBy', 'obtainability', 'confChosen', 'confRaiseReason',
  'consequenceConfirmedBy', 'consequenceConfirmedOn', 'expectedRung', 'flags', 'confidence', 'notDeterminable', 'dl3Rows'];
const FIRST_HIDDEN_FIELD = 15;

/** The entries this user may not yet see the classification of. */
export function blindIds(data, user) {
  if (!data || !user || !(user.roles || []).includes('peer')) return new Set();
  return new Set((data.entries || []).filter(e => e && e.classifiedBy !== user.id && !((e.peerReview || {}).tier)).map(e => e.id));
}

/** A copy of the assessment with the classifier's work removed from the user's blind entries. */
export function redactFor(data, user) {
  const ids = blindIds(data, user);
  if (!ids.size) return data;
  const d = JSON.parse(JSON.stringify(data));
  d.entries.forEach(e => {
    if (!ids.has(e.id)) return;
    // Reset to what a blank entry holds, so the browser sees the usual shape.
    const blank = { tierProposed: '', tierOverrideReason: '', authorityTests: (e.authorityTests || [0, 0, 0, 0]).map(() => ({ answer: null, source: '' })), classifiedBy: '', reviewedBy: '',
      obtainability: { start: '', rungs: {} }, confChosen: '', confRaiseReason: '', consequenceConfirmedBy: '', consequenceConfirmedOn: '', notDeterminable: { on: false, question: '', who: '', since: '' }, dl3Rows: [] };
    HIDDEN_KEYS.forEach(k => { if (k in blank) e[k] = blank[k]; else delete e[k]; });
    Object.keys(e.fields || {}).forEach(n => { if (+n >= FIRST_HIDDEN_FIELD) delete e.fields[n]; });
    e.peerReview = { ...(e.peerReview || {}), differs: false };
  });
  d.history = (d.history || []).map(h => (h && ids.has(h.target) ? { at: h.at, by: h.by, action: 'hidden', target: h.target } : h));
  d.versions = (d.versions || []).map(v => {
    const s = v && v.snapshot; if (!s || !s.entries) return v;
    const entries = {};
    Object.entries(s.entries).forEach(([id, x]) => { entries[id] = ids.has(id) ? { arr: x.arr, f: Object.fromEntries(Object.entries(x.f || {}).filter(([n]) => +n < FIRST_HIDDEN_FIELD)) } : x; });
    return { ...v, snapshot: { ...s, entries, findings: {} } };
  });
  d.findings = [];
  d.blind = [...ids];
  return d;
}

/**
 * Puts the withheld values back into a save from a user who was sent a redacted copy.
 * Also decides whether a newly recorded peer tier differs from the classifier's, which the peer could not see.
 * Returns { data, unblinded } where unblinded is true when the save ends blindness on any entry.
 */
export function unredactSave(stored, incoming, user) {
  const ids = blindIds(stored, user);
  delete incoming.blind;
  if (!ids.size || !stored) return { data: incoming, unblinded: false };
  const sE = new Map((stored.entries || []).map(e => [e.id, e]));
  let unblinded = false;
  (incoming.entries || []).forEach(e => {
    if (!e || !ids.has(e.id) || !sE.has(e.id)) return;
    const s = sE.get(e.id);
    HIDDEN_KEYS.forEach(k => { if (k in s) e[k] = JSON.parse(JSON.stringify(s[k])); else delete e[k]; });
    e.fields = e.fields && typeof e.fields === 'object' ? e.fields : {};
    Object.keys(e.fields).forEach(n => { if (+n >= FIRST_HIDDEN_FIELD) delete e.fields[n]; });
    Object.entries(s.fields || {}).forEach(([n, f]) => { if (+n >= FIRST_HIDDEN_FIELD) e.fields[n] = JSON.parse(JSON.stringify(f)); });
    const pr = e.peerReview || {}, was = s.peerReview || {};
    if (pr.tier && !was.tier) {
      const t = ((s.fields || {})[15] || {}).value || '';
      e.peerReview = { ...pr, differs: !!t && pr.tier !== t };
      unblinded = true;
    } else if (e.peerReview) e.peerReview = { ...e.peerReview, differs: !!was.differs };
  });
  // The redacted copy had placeholder history entries; the stored ones are restored in place.
  const sh = stored.history || [];
  if (Array.isArray(incoming.history)) incoming.history = incoming.history.map((h, i) => (i < sh.length ? sh[i] : h));
  // Findings are worked out by the browser from what it can see; a blind browser's are incomplete.
  incoming.findings = JSON.parse(JSON.stringify(stored.findings || []));
  return { data: incoming, unblinded };
}
