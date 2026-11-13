// Server-side permission check for assessment saves. The same rules as the app's deny(), applied to
// what actually changed between the stored assessment and the one being saved. Rules that depend on who
// did what (peer independence, validation independence, blind review) are checked against the stored data.
// Cloud-neutral: no Cloudflare, AWS or Azure code here.
import { TRIODIAN } from './roles.js';
import { withVersions } from './versions.js';
import { suppliers } from './handover.js';
import { storedBriefError } from '../../public/shared/matter-brief.js';

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

/* Once closed (R7 complete and the hand-back list accepted), only the closing steps can change: the annex,
   the hand-back acceptance and R7 itself. Anything else would change a closed record. */
const OPEN_WHEN_CLOSED = new Set(['annex', 'sign', 'handBack', 'r7']);
const closedData = S => !!(S && ((S.reviews || []).find(r => r && r.point === 'R7') || {}).result === 'complete' && ((S.engagement || {}).handBack || {}).by);
const validatedBy = (S, id) => !!((S && S.reviews) || []).find(r => r && r.point === 'R4' && r.by === id && r.result);

/** One person may not give both agreements to the set (R1) unless set-up says the GC also acts as counsel. */
export const BOTH_AGREEMENTS = 'You recorded the other agreement to the set. One person cannot give both: if the GC also acts as counsel, tick “The GC also acts as counsel” in set-up and name a second approver, who gives the second agreement.';

/** The app's rules. user: { id, roles[], isAdmin }. S: the stored assessment. x: the stored entry, when the change is to one. */
export function deny(target, user, S, x) {
  const r = k => (user.roles || []).includes(k), tri = TRIODIAN.some(r), id = user.id;
  const entries = (S && S.entries) || [];
  const blind = e => !!(e && r('peer') && !(e.peerReview || {}).tier && e.classifiedBy !== id);
  if (closedData(S) && !OPEN_WHEN_CLOSED.has(target)) return 'This assessment is closed: the independent review (R7) is complete and the hand-back list is accepted. Start the next assessment to make further changes.';
  switch (target) {
    case 'setup': return r('methodOwner') || r('delivery') || user.isAdmin ? '' : 'Only the method owner, the delivery manager or an administrator can change set-up.';
    case 'set': return r('methodOwner') || r('assessor') || r('delivery') ? '' : 'Only the method owner, an assessor or the delivery manager can record arrangements.';
    case 'agreeGC': {
      if (!r('gc')) return 'Only the GC can record the GC’s agreement to the set.';
      const sa = (S && S.setAgreed) || {}, e = (S && S.engagement) || {};
      if (!e.gcActsAsCounsel && sa.counselBy && sa.counselBy === id) return BOTH_AGREEMENTS;
      return '';
    }
    case 'agreeCounsel': {
      // Where the GC also acts as counsel (development plan task 0.5), the second agreement comes from the second approver named in set-up.
      const sa = (S && S.setAgreed) || {}, e = (S && S.engagement) || {};
      if (e.gcActsAsCounsel) {
        if (!e.secondApproverId) return 'The GC also acts as counsel. Name the second approver in set-up first.';
        return e.secondApproverId === id && r('executive') ? '' : 'The GC also acts as counsel, so the second agreement to the set comes from the second approver named in set-up.';
      }
      if (!r('counsel')) return 'Only counsel can record counsel’s agreement to the set.';
      if (sa.gcBy && sa.gcBy === id) return BOTH_AGREEMENTS;
      return '';
    }
    case 'facts':
      if (!(r('assessor') || r('methodOwner'))) return 'Only an assessor or the method owner can enter facts.';
      if (x && (x.peerReview || {}).personId === id) return 'You are the peer reviewer of this entry, so you cannot edit it.';
      return '';
    case 'classify':
      if (!(r('assessor') || r('methodOwner'))) return 'Only an assessor or the method owner can classify an entry.';
      if (validatedBy(S, id)) return 'You recorded R4 (validation), so you cannot classify entries in this assessment.';
      if (x && (x.peerReview || {}).personId === id) return 'You are the peer reviewer of this entry, so you cannot classify it.';
      if (x && blind(x)) return 'Record your own tier for this entry first (R3, classification review).';
      return '';
    case 'consequence': return r('owner') ? '' : 'Only the arrangement owner can confirm the failure consequence.';
    case 'peer':
      if (!r('peer')) return 'Only a peer reviewer can re-derive the tier (R3).';
      if (validatedBy(S, id)) return 'You recorded R4 (validation), so you cannot peer-review entries in this assessment.';
      if (x && x.classifiedBy === id) return 'You classified this entry, so you cannot review it.';
      if (x && (x.peerReview || {}).personId && x.peerReview.personId !== id) return 'Another peer reviewer has already recorded R3 for this entry.';
      return '';
    case 'r2': return r('delivery') ? '' : 'Only the delivery manager can run R2 (register completeness).';
    case 'r4':
      if (!r('validation')) return 'Only a validation person can record R4 (validation).';
      if (entries.some(e => e.classifiedBy === id || (e.peerReview || {}).personId === id)) return 'You classified or peer-reviewed an entry in the set, so you cannot validate it.';
      return '';
    case 'r5': return r('methodOwner') ? '' : 'Only the method owner can clear legal-line hits or change the phrase list (R5).';
    case 'r6': return r('counsel') ? '' : 'Only counsel can record R6 (counsel review).';
    case 'r7': {
      const e = (S && S.engagement) || {};
      if (suppliers(S).has(id)) return 'You supplied or confirmed the hand-over, so you cannot confirm the independent review (R7).';
      // The reviewer's firm and declaration of independence are recorded before R7 is confirmed (task ISO.6).
      if (!String(e.irOrganisation || '').trim()) return 'Record the independent reviewer’s firm in set-up before R7 is confirmed.';
      if (!String((e.irDeclaration || {}).text || '').trim()) return 'Record the independent reviewer’s declaration of independence in set-up before R7 is confirmed.';
      if ((S.independentReviewPoints || []).some(p => p.status === 'open')) return 'Close or disclose every review point first.';
      if (e.independentReviewerReportsTo === 'cro') return r('cro') && (!e.croPersonId || e.croPersonId === id) ? '' : 'The independent reviewer reports directly to the CRO, so only the CRO named in set-up can confirm R7 (independent review).';
      return r('ir') ? '' : 'The independent reviewer reports through counsel, so only the independent reviewer can confirm R7 (independent review).';
    }
    case 'irLog': return !r('ir') ? 'Only the independent reviewer can log review points.' : suppliers(S).has(id) ? 'You supplied or confirmed the hand-over, so you cannot act as the independent reviewer.' : '';
    case 'irRespond': return tri ? '' : 'Only someone with a Triodian role can respond to review points.';
    case 'irClose': return !r('ir') ? 'Only the independent reviewer can close or disclose a review point.' : suppliers(S).has(id) ? 'You supplied or confirmed the hand-over, so you cannot act as the independent reviewer.' : '';
    case 'tri': return tri ? '' : 'Only someone with a Triodian role can record this.';
    case 'ask': return tri ? '' : 'Only someone with a Triodian role can raise questions to counsel.';
    case 'answer': return r('counsel') || tri ? '' : 'Only counsel can record the response, or someone with a Triodian role transcribing counsel’s written response.';
    case 'annex': return r('methodOwner') ? '' : 'Only the method owner can write the annex text.';
    case 'sign':
      if (!r('methodOwner')) return 'Only the method owner can sign the annex.';
      if (entries.some(e => (e.peerReview || {}).personId === id)) return 'You are the only peer reviewer of at least one entry, so you cannot sign the annex.';
      return '';
    case 'handBack': return r('owner') ? '' : 'Only the inventory owner (the arrangement owner role) can accept the hand-back list.';
  }
  return 'This change is not allowed.';
}

/** Which rule an entry change falls under. */
/** Empty values a blank entry starts with: '', null, false, [], {} and anything made only of those. */
const deepEmpty = v => v == null || v === '' || v === false || (Array.isArray(v) ? v.every(deepEmpty) : typeof v === 'object' ? Object.values(v).every(deepEmpty) : false);
const REVIEW_POINTS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];
/** Practitioner branding (development plan task 0.4): a firm, a line under it and a PNG logo of 100 KB at most.
 *  The browser applies the same rule in public/brand.js. Returns a message, or '' when it is sound. */
function practitionerError(p) {
  if (p == null) return '';
  if (typeof p !== 'object' || Array.isArray(p)) return 'The practitioner details are not valid.';
  if (p.firm != null && (typeof p.firm !== 'string' || p.firm.length > 200)) return 'The practitioner firm must be text of 200 characters or less.';
  if (p.line != null && (typeof p.line !== 'string' || p.line.length > 300)) return 'The line under the firm must be text of 300 characters or less.';
  if (p.logo != null && p.logo !== '') {
    const m = typeof p.logo === 'string' && /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(p.logo);
    if (!m || !m[1].startsWith('iVBORw0KGgo')) return 'The logo must be a PNG image.';
    if (Math.floor(m[1].length * 3 / 4) > 100 * 1024 + 2) return 'The logo must be 100 KB or less.';
  }
  return '';
}

/**
 * The shape every save must have. Each keyed list holds objects with a valid, unique key, so that one item
 * cannot be listed twice (a second copy would be checked while the first is the one the app reads).
 * Returns a message, or '' when the shape is sound.
 */
/** The sector pack (development plan task 3.2) is fixed once a register entry is recorded or a version issued. */
export const DEFAULT_PACK = 'generalInsurer';
export const packOf = d => ((d && d.engagement && d.engagement.sectorPack) || DEFAULT_PACK);
export const packLocked = d => !!d && ((Array.isArray(d.entries) && d.entries.length > 0) || (Array.isArray(d.versions) && d.versions.length > 0));

export function structureError(d) {
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(d.engagement)) return 'The engagement details are missing.';
  { const pe = practitionerError(d.engagement.practitioner); if (pe) return pe; }
  { const be = storedBriefError(d.engagement.matterBrief); if (be) return be; }
  if (d.feedback != null) { const f = d.feedback; if (!isObj(f) || f.schema !== 'triodian.aua.extract.v2' || !Array.isArray(f.entries) || !Array.isArray(f.measures) || JSON.stringify(f).length > 500000) return 'The in-use feed is not a register extract v2.'; }
  { const sp = d.engagement.sectorPack; if (sp != null && sp !== '' && (typeof sp !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(sp))) return 'The sector pack is not a valid pack id.'; }
  const lists = { arrangements: 'id', entries: 'id', questions: 'ref', reviews: 'point', independentReviewPoints: 'ref', exceptions: 'ref', documents: null, interviews: null, findings: null, history: null, versions: null };
  for (const [name, key] of Object.entries(lists)) {
    const v = d[name];
    if (v == null) continue;
    if (!Array.isArray(v)) return `"${name}" must be a list.`;
    const seen = new Set();
    for (let i = 0; i < v.length; i++) {
      const x = v[i];
      if (!isObj(x)) return `Item ${i + 1} of "${name}" is not valid.`;
      if (!key) continue;
      const k = x[key];
      if (typeof k !== 'string' || !IDRE.test(k)) return `Item ${i + 1} of "${name}" has no valid ${key}.`;
      if (name === 'reviews' && !REVIEW_POINTS.includes(k)) return `"${k}" is not a review point.`;
      if (seen.has(k)) return `"${k}" appears twice in "${name}".`;
      seen.add(k);
    }
  }
  for (const e of d.entries || []) {
    if (e.fields != null && !isObj(e.fields)) return `The fields of ${e.id} are not valid.`;
    for (const [n, f] of Object.entries(e.fields || {})) {
      if (!/^\d+$/.test(n) || +n < 1 || +n > 26) return `${e.id} has an unknown field "${n}".`;
      if (f != null && !isObj(f)) return `Field ${n} of ${e.id} is not valid.`;
    }
    if (e.peerReview != null && !isObj(e.peerReview)) return `The peer review of ${e.id} is not valid.`;
  }
  return '';
}

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
  const shape = structureError(newData);
  if (shape) return { status: 400, error: shape + ' Nothing was saved.' };
  const data = JSON.parse(JSON.stringify(newData));
  data.engagement.example = false;
  data.engagement.autosave = false;
  CLIENT_ONLY.forEach(k => { delete data[k]; });
  if (oldData) data.engagement.id = oldData.engagement.id;
  else if (typeof data.engagement.id !== 'string' || !IDRE.test(data.engagement.id)) return { status: 400, error: 'The assessment id is not valid.' };
  data.people = buildPeople(users);
  // The hand-over is changed only through PUT /api/handover (lib/core/handover.js), never by a save.
  if (oldData && oldData.handover) data.handover = JSON.parse(JSON.stringify(oldData.handover)); else delete data.handover;
  // So is the record of updates, contested points, consultations and structured reviews (PUT /api/liaison).
  if (oldData && oldData.liaison) data.liaison = JSON.parse(JSON.stringify(oldData.liaison)); else delete data.liaison;

  const refusals = [];
  const need = (t, x) => { const why = deny(t, user, oldData, x); if (why) refusals.push(why); };
  const needOneOf = (ts, x) => { if (!ts.some(t => !deny(t, user, oldData, x))) refusals.push(deny(ts[0], user, oldData, x)); };

  if (!oldData) {
    need('setup');
  } else {
    const o = oldData, n = data;
    if (packOf(o) !== packOf(n) && packLocked(o)) return { status: 409, error: 'The sector pack is fixed once a register entry is recorded. Nothing was saved.' };
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
      keysOf(a, b).forEach(k => { if (!same(a[k], b[k])) need(['findingOwner', 'dl4Triggers', 'corrective'].includes(k) ? 'tri' : 'set'); });
    });
    // register entries
    const oE = byKey(o.entries, 'id'), nE = byKey(n.entries, 'id');
    keysOf(Object.fromEntries(oE), Object.fromEntries(nE)).forEach(id => {
      let a = oE.get(id); const b = nE.get(id);
      if (!b) return need('facts', a);
      // A new entry is checked as an edit of a blank one, so it cannot arrive already classified, reviewed or confirmed.
      if (!a) { need('facts'); a = { id: b.id, arrangementId: b.arrangementId, fields: {} }; }
      keysOf(a, b).forEach(k => {
        if (same(a[k], b[k]) || (!(k in a) && deepEmpty(b[k]))) return;
        if (k === 'fields') {
          keysOf(a.fields, b.fields).forEach(f => { const fa = (a.fields || {})[f], fb = (b.fields || {})[f]; if (!same(fa, fb) && !(fa == null && deepEmpty(fb))) need(fieldTarget(+f), a); });
          return;
        }
        need(entryTarget(k, a, b, user.id), a);
        if (k === 'classifiedBy' && b.classifiedBy && b.classifiedBy !== user.id) refusals.push('A classification is recorded in your own name only.');
        // Who classified an entry, and who peer-reviewed it, can be changed only by the method owner: otherwise a
        // classifier could clear their own name and then review their own work.
        if (k === 'classifiedBy' && a.classifiedBy && !(user.roles || []).includes('methodOwner')) refusals.push('Only the method owner can change who classified an entry.');
        if (k === 'peerReview' && (a.peerReview || {}).personId && (b.peerReview || {}).personId !== a.peerReview.personId && !(user.roles || []).includes('methodOwner')) refusals.push('Only the method owner can change who peer-reviewed an entry.');
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
    keysOf(Object.fromEntries(oR), Object.fromEntries(nR)).forEach(p => {
      const a = oR.get(p) || {}, b = nR.get(p) || {};
      if (same(a, b) || (!oR.has(p) && deepEmpty({ ...b, point: '' }))) return;
      needOneOf(RT[p] || ['tri']);
      if (b.by && b.by !== a.by && b.by !== user.id) refusals.push(`${p} is recorded in your own name only.`);
    });
    if (!same(o.r5Cleared, n.r5Cleared)) need('r5');
    // Triodian's records
    ['findings', 'exceptions', 'feedback'].forEach(k => { if (!same(o[k], n[k])) need('tri'); });
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
      if (['schema', 'engagement', 'people', 'setAgreed', 'documents', 'interviews', 'calibration', 'diffReports', 'arrangements', 'entries', 'questions', 'reviews', 'r5Cleared', 'findings', 'exceptions', 'feedback', 'independentReviewPoints', 'versions', 'previous', 'history'].includes(k)) return;
      if (!same(o[k], n[k])) need('setup');
    });
    // history is append only; new entries are signed by the server
    if (!isPrefix(o.history || [], n.history, ['by'])) return { status: 409, error: 'The change history does not match the saved assessment. Reload to get the latest version.' };
    n.history = (o.history || []).concat((n.history || []).slice((o.history || []).length));
  }

  if (refusals.length) return { status: 403, error: [...new Set(refusals)].slice(0, 3).join(' ') + ' Nothing was saved.' };
  const start = oldData ? (oldData.history || []).length : 0;
  data.history = (data.history || []).map((h, i) => (i >= start && h && typeof h === 'object' ? { ...h, by: user.name || user.email } : h));
  data.previous = oldData ? (oldData.previous || null) : null;
  const newVersion = withVersions(oldData, data, user.name || user.email, new Date().toISOString());
  return { data, newVersion };
}
