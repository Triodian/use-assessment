// Server-side permission check for assessment saves. The same rules as the app's deny(), applied to
// what actually changed between the stored assessment and the one being saved. Rules that depend on who
// did what (peer independence, validation independence, blind review) are checked against the stored data.
// Cloud-neutral: no Cloudflare, AWS or Azure code here.
import { TRIODIAN } from './roles.js';
import { withVersions } from './versions.js';

const IDRE = /^[A-Za-z0-9_.:-]{1,64}$/;

export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const same = (a, b) => stable(a) === stable(b);
/** Shown by the browser only (notes from loading an older file, the time a file was saved); never stored. */
const CLIENT_ONLY = ['loadNotes', 'savedAt', 'note'];
const keysOf = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
const byKey = (arr, k) => new Map((Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object').map(x => [String(x[k]), x]));
const isPrefix = (oldArr, newArr, ignore = []) => {
  if (!Array.isArray(newArr) || newArr.length < oldArr.length) return false;
  const strip = x => { if (!x || typeof x !== 'object') return x; const c = { ...x }; ignore.forEach(k => delete c[k]); return c; };
  return oldArr.every((x, i) => same(strip(x), strip(newArr[i])));
};

/** The assessment's people list comes from the user list: everyone with at least one engagement role. */
export function buildPeople(users) {
  return users.filter(u => (u.roles || []).length).map(u => ({ id: u.id, name: u.name || u.email, organisation: u.organisation || '', roles: u.roles.slice(), active: !!u.active }));
}

/** The app's rules. user: { id, roles[], isAdmin }. S: the stored assessment. x: the stored entry, when the change is to one. */
export function deny(target, user, S, x) {
  const r = k => (user.roles || []).includes(k), tri = TRIODIAN.some(r), id = user.id;
  const entries = (S && S.entries) || [];
  const blind = e => !!(e && r('peer') && !(e.peerReview || {}).tier && e.classifiedBy !== id);
  switch (target) {
    case 'setup': return r('methodOwner') || r('delivery') || user.isAdmin ? '' : 'Set-up is kept by the method owner, the delivery manager or an administrator.';
    case 'set': return r('methodOwner') || r('assessor') || r('delivery') ? '' : 'Arrangements are recorded by the method owner, an assessor or the delivery manager.';
    case 'agreeGC': return r('gc') ? '' : 'Only the GC records the GC’s agreement to the set.';
    case 'agreeCounsel': return r('counsel') ? '' : 'Only counsel records counsel’s agreement to the set.';
    case 'facts':
      if (!(r('assessor') || r('methodOwner'))) return 'Facts are entered by an assessor or the method owner.';
      if (x && (x.peerReview || {}).personId === id) return 'You are the peer reviewer of this entry, so you cannot edit it.';
      return '';
    case 'classify':
      if (!(r('assessor') || r('methodOwner'))) return 'Classification is done by an assessor or the method owner.';
      if (x && (x.peerReview || {}).personId === id) return 'You are the peer reviewer of this entry, so you cannot classify it.';
      if (x && blind(x)) return 'Record your blind re-derivation (R3) first.';
      return '';
    case 'consequence': return r('owner') ? '' : 'Only the arrangement owner confirms the failure consequence.';
    case 'peer':
      if (!r('peer')) return 'Only a peer reviewer re-derives the tier.';
      if (x && x.classifiedBy === id) return 'You classified this entry, so you cannot review it.';
      if (x && (x.peerReview || {}).personId && x.peerReview.personId !== id) return 'Another peer reviewer has recorded R3 for this entry.';
      return '';
    case 'r2': return r('delivery') ? '' : 'R2 is run by the delivery manager.';
    case 'r4':
      if (!r('validation')) return 'R4 is recorded by a validation person.';
      if (entries.some(e => e.classifiedBy === id || (e.peerReview || {}).personId === id)) return 'You classified or peer-reviewed an entry in the set, so you cannot validate it.';
      return '';
    case 'r5': return r('methodOwner') ? '' : 'Legal-line hits and the phrase list are kept by the method owner.';
    case 'r6': return r('counsel') ? '' : 'R6 is recorded by counsel.';
    case 'r7': {
      const e = (S && S.engagement) || {};
      if ((S.independentReviewPoints || []).some(p => p.status === 'open')) return 'Close or disclose every review point first.';
      if (e.independentReviewerReportsTo === 'cro') return r('cro') && (!e.croPersonId || e.croPersonId === id) ? '' : 'With the reporting line directly to the CRO, the CRO named in set-up confirms R7.';
      return r('ir') ? '' : 'With the reporting line through counsel, the independent reviewer confirms R7.';
    }
    case 'irLog': return r('ir') ? '' : 'Review points are logged by the independent reviewer.';
    case 'irRespond': return tri ? '' : 'Triodian responds to review points.';
    case 'irClose': return r('ir') ? '' : 'Only the independent reviewer closes or discloses a review point.';
    case 'tri': return tri ? '' : 'Triodian records this.';
    case 'ask': return tri ? '' : 'Questions to counsel are raised by Triodian.';
    case 'answer': return r('counsel') || tri ? '' : 'Counsel enters the response, or Triodian transcribes it.';
    case 'annex': return r('methodOwner') ? '' : 'The method owner writes the annex.';
    case 'sign':
      if (!r('methodOwner')) return 'The method owner signs the annex.';
      if (entries.some(e => (e.peerReview || {}).personId === id)) return 'You are the only peer reviewer of at least one entry, so you cannot sign the annex.';
      return '';
    case 'handBack': return r('owner') ? '' : 'The hand-back list is accepted by the inventory owner (arrangement owner role).';
  }
  return 'This change is not allowed.';
}

/** Which rule an entry change falls under. */
function entryTarget(key, oldE, newE, userId) {
  const m = /^fields$/.test(key);
  if (m) return null; // fields are checked one by one
  if (['tierProposed', 'tierOverrideReason', 'confChosen', 'confRaiseReason', 'authorityTests', 'obtainability', 'classifiedBy'].includes(key)) return 'classify';
  if (key === 'consequenceConfirmedBy' || key === 'consequenceConfirmedOn') return (newE && newE.consequenceConfirmedBy) ? 'consequence' : 'classify';
  if (key === 'peerReview' || key === 'reviewedBy') return 'peer';
  if (key === 'dl3Rows') return 'tri';
  return 'facts';
}
const fieldTarget = n => (n <= 14 ? 'facts' : n <= 22 ? 'classify' : 'answer');

/**
 * Checks a save. oldData: the stored assessment (null if none). newData: what the browser sent.
 * user: { id, email, name, roles[], isAdmin }. users: all users (for the people list).
 * Returns { error, status } or { data } with the assessment to store.
 */
export function checkSave(oldData, newData, user, users) {
  if (!newData || typeof newData !== 'object' || newData.schema !== 'triodian.aua.v1') return { status: 400, error: 'Not an AI Use Assessment.' };
  if (!newData.engagement || typeof newData.engagement !== 'object') return { status: 400, error: 'The engagement details are missing.' };
  const data = JSON.parse(JSON.stringify(newData));
  data.engagement.example = false;
  data.engagement.autosave = false;
  CLIENT_ONLY.forEach(k => { delete data[k]; });
  if (oldData) data.engagement.id = oldData.engagement.id;
  else if (typeof data.engagement.id !== 'string' || !IDRE.test(data.engagement.id)) return { status: 400, error: 'The assessment id is not valid.' };
  data.people = buildPeople(users);

  const refusals = [];
  const need = (t, x) => { const why = deny(t, user, oldData, x); if (why) refusals.push(why); };
  const needOneOf = (ts, x) => { if (!ts.some(t => !deny(t, user, oldData, x))) refusals.push(deny(ts[0], user, oldData, x)); };

  if (!oldData) {
    need('setup');
  } else {
    const o = oldData, n = data;
    // engagement details
    keysOf(o.engagement, n.engagement).forEach(k => {
      if (['id', 'example', 'autosave'].includes(k) || same(o.engagement[k], n.engagement[k])) return;
      if (k === 'legalPhrases') return need('r5');
      if (k === 'annexText') return need('annex');
      if (k === 'annexSigned') { need('sign'); if (n.engagement.annexSigned && n.engagement.annexSigned.by && n.engagement.annexSigned.by !== user.id) refusals.push('The annex is signed in your own name only.'); return; }
      if (k === 'handBack') { need('handBack'); if (n.engagement.handBack && n.engagement.handBack.by && n.engagement.handBack.by !== user.id) refusals.push('The hand-back is accepted in your own name only.'); return; }
      need('setup');
    });
    // set agreement (R1)
    const oa = o.setAgreed || {}, na = n.setAgreed || {};
    if (!same(oa.gcBy, na.gcBy) || !same(oa.gcOn, na.gcOn)) { need('agreeGC'); if (na.gcBy && na.gcBy !== user.id) refusals.push('The GC’s agreement is recorded in your own name only.'); }
    if (!same(oa.counselBy, na.counselBy) || !same(oa.counselOn, na.counselOn)) { need('agreeCounsel'); if (na.counselBy && na.counselBy !== user.id) refusals.push('Counsel’s agreement is recorded in your own name only.'); }
    if (!same(oa.on, na.on) && same(oa.gcBy, na.gcBy) && same(oa.counselBy, na.counselBy)) needOneOf(['agreeGC', 'agreeCounsel']);
    // set-up collections
    ['documents', 'interviews', 'calibration', 'diffReports'].forEach(k => { if (!same(o[k], n[k])) need('setup'); });
    // arrangements
    const oA = byKey(o.arrangements, 'id'), nA = byKey(n.arrangements, 'id');
    keysOf(Object.fromEntries(oA), Object.fromEntries(nA)).forEach(id => {
      const a = oA.get(id), b = nA.get(id);
      if (!a || !b) return need('set');
      keysOf(a, b).forEach(k => { if (!same(a[k], b[k])) need(['findingOwner', 'dl4Triggers'].includes(k) ? 'tri' : 'set'); });
    });
    // register entries
    const oE = byKey(o.entries, 'id'), nE = byKey(n.entries, 'id');
    keysOf(Object.fromEntries(oE), Object.fromEntries(nE)).forEach(id => {
      const a = oE.get(id), b = nE.get(id);
      if (!a || !b) return need('facts', a);
      keysOf(a, b).forEach(k => {
        if (same(a[k], b[k])) return;
        if (k === 'fields') {
          keysOf(a.fields, b.fields).forEach(f => { if (!same((a.fields || {})[f], (b.fields || {})[f])) need(fieldTarget(+f), a); });
          return;
        }
        need(entryTarget(k, a, b, user.id), a);
        if (k === 'classifiedBy' && b.classifiedBy && b.classifiedBy !== user.id) refusals.push('A classification is recorded in your own name only.');
        if (k === 'consequenceConfirmedBy' && b.consequenceConfirmedBy && b.consequenceConfirmedBy !== user.id) refusals.push('The consequence is confirmed in your own name only.');
        if (k === 'peerReview' && (b.peerReview || {}).personId && b.peerReview.personId !== user.id && !same((a.peerReview || {}).personId, b.peerReview.personId)) refusals.push('A peer review is recorded in your own name only.');
      });
    });
    // questions to counsel
    const oQ = byKey(o.questions, 'ref'), nQ = byKey(n.questions, 'ref');
    keysOf(Object.fromEntries(oQ), Object.fromEntries(nQ)).forEach(ref => {
      const a = oQ.get(ref), b = nQ.get(ref);
      if (!a || !b) return need('ask');
      keysOf(a, b).forEach(k => {
        if (same(a[k], b[k])) return;
        if (['response', 'respondedOn', 'enteredBy', 'transcribedBy', 'determination', 'reach'].includes(k) || (k === 'status' && b.status === 'answered')) return need('answer');
        if (k === 'owner' || (k === 'status' && b.status === 'openWithOwner')) return need('tri');
        need('ask');
      });
    });
    // review points R1 to R7
    const oR = byKey(o.reviews, 'point'), nR = byKey(n.reviews, 'point');
    const RT = { R1: ['agreeGC', 'agreeCounsel'], R2: ['r2'], R3: ['peer'], R4: ['r4'], R5: ['r5'], R6: ['r6'], R7: ['r7'] };
    keysOf(Object.fromEntries(oR), Object.fromEntries(nR)).forEach(p => { if (!same(oR.get(p), nR.get(p))) needOneOf(RT[p] || ['tri']); });
    if (!same(o.r5Cleared, n.r5Cleared)) need('r5');
    // Triodian's records
    ['findings', 'exceptions'].forEach(k => { if (!same(o[k], n[k])) need('tri'); });
    // independent review points
    const oI = byKey(o.independentReviewPoints, 'ref'), nI = byKey(n.independentReviewPoints, 'ref');
    keysOf(Object.fromEntries(oI), Object.fromEntries(nI)).forEach(ref => {
      const a = oI.get(ref), b = nI.get(ref);
      if (!a || !b) return need('irLog');
      keysOf(a, b).forEach(k => { if (!same(a[k], b[k])) need(k === 'response' ? 'irRespond' : k === 'status' ? 'irClose' : 'irLog'); });
    });
    // anything else at the top level is set-up
    keysOf(o, n).forEach(k => {
      if (CLIENT_ONLY.includes(k)) return;
      if (['schema', 'engagement', 'people', 'setAgreed', 'documents', 'interviews', 'calibration', 'diffReports', 'arrangements', 'entries', 'questions', 'reviews', 'r5Cleared', 'findings', 'exceptions', 'independentReviewPoints', 'versions', 'history'].includes(k)) return;
      if (!same(o[k], n[k])) need('setup');
    });
    // history is append only; new entries are signed by the server
    if (!isPrefix(o.history || [], n.history, ['by'])) return { status: 409, error: 'The change history does not match the saved assessment. Reload to get the latest version.' };
    n.history = (o.history || []).concat((n.history || []).slice((o.history || []).length));
  }

  if (refusals.length) return { status: 403, error: [...new Set(refusals)].slice(0, 3).join(' ') + ' Nothing was saved.' };
  const start = oldData ? (oldData.history || []).length : 0;
  data.history = (data.history || []).map((h, i) => (i >= start && h && typeof h === 'object' ? { ...h, by: user.name || user.email } : h));
  const newVersion = withVersions(oldData, data, user.name || user.email, new Date().toISOString());
  return { data, newVersion };
}
