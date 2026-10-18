/* AI Use Assessment · Triodian
   Single-page app. The assessment is saved on the server (one assessment per site), and every save is checked
   against the signed-in person's roles there too. The worked example runs in the browser only and is never saved. Shares app.css and the term-popover component with the AI Risk Appetite app. */
(function () {
'use strict';
let C = null, S = null;
const UI = { screen: 'entry', personId: '', drawer: false, pop: null, sheet: null, entryId: null, tab: 'facts', step: 1, outTab: 'DL1', cnTab: 'log', filt: { arr: '', b: '', f: '', flag: '', nk: false }, refQ: '', present: false, dirty: false, err: {}, hist: null, ask: null, expanded: {}, qOpen: null };
const AT = ['A1','A2','A3','A4','A5','A6'], CO = ['C1','C2','C3','C4','C5'], EV = ['E0','E1','E2','E3','E4','E5','E6'], CONF = ['low','medium','high'], PRI = ['Low','Medium','High'];
const TRI = ['methodOwner','assessor','peer','validation','delivery'], MARKS = ['Accepted', 'Escalate', 'Not accepted'], BANDS = ['b12', 'b3', 'b45'], TESTS = ['T1', 'T2', 'T3', 'T4', 'T5'];
const IDRE = /^[A-Za-z0-9_.:-]{1,64}$/;
const sid = s => String(s == null ? '' : s).replace(/[^a-zA-Z0-9_-]/g, '_');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const fmtAt = s => s ? s.replace('T', ' ').slice(0, 16) : '';
const rk = (a, v) => a.indexOf(v);
const bp = () => innerWidth >= 1024 ? 'desk' : innerWidth >= 640 ? 'tab' : 'phone';
const T = (id, text) => C.glossary[id] ? `<button type="button" class="term" data-term="${id}" aria-expanded="false" aria-controls="poproot">${text || esc(C.glossary[id].term)}</button>` : (text || '');
const linkify = s => esc(s).replace(/\[\[(\w+)(?:\|([^\]]+))?\]\]/g, (m, id, t) => T(id, t ? esc(t) : esc(C.glossary[id] ? C.glossary[id].term.toLowerCase() : id)));
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const roleName = r => (C.roles.find(x => x.id === r) || {}).name || r;
const person = id => S.people.find(p => p.id === id);
const pname = id => { const p = person(id); return p ? p.name : ''; };
const me = () => S ? person(UI.personId) || (SRV.user && !practice() && UI.personId === SRV.user.id ? { id: SRV.user.id, name: SRV.user.name || SRV.user.email, roles: SRV.user.roles || [] } : null) : null;
const has = r => { const p = me(); return !!(p && p.roles.includes(r)); };
const isTri = () => TRI.some(has);
const canFacts = () => has('assessor') || has('methodOwner');
const tierName = c => (C.tiers.find(t => t.code === c) || {}).name || '';
const consName = c => (C.consequences.find(t => t.code === c) || {}).name || '';
const rungName = c => (C.rungs.find(t => t.code === c) || {}).name || '';
/* Lookups never throw: an unknown id returns a placeholder, and brokenRefs() lists it on the Review screen. */
const FLD = n => { const f = C.fields.find(x => x.n === +n); if (f && f.n === 17) return Object.assign({}, f, { name: rungLabel() }); return f || { n: +n, name: 'Unknown field ' + n, format: '', kind: 'text', tab: 'facts', missing: true }; };
const ent = id => S.entries.find(e => e.id === id);
/* An unknown or empty arrangement id always returns the placeholder, never null, so every renderer can show it. */
const arr = id => S.arrangements.find(a => a.id === id && id) || { id: String(id || ''), name: id ? '[missing arrangement]' : '[no arrangement]', parties: '', boundaries: [], criteria: [], reason: '', nextContracting: '', function: '', findingOwner: '', missing: true };
const arrIdx = a => S.arrangements.indexOf(a);
const fnOf = e => e.functionName || ((arr(e.arrangementId) || {}).function) || '';
const fv = (e, n) => { const f = e.fields[n]; return f && !f.notKnown ? f.value : ''; };
const band = c => c === 'C1' || c === 'C2' ? 'b12' : c === 'C3' ? 'b3' : 'b45';
const optL = v => C.optLabels[v] || v;

/* ---------- model ---------- */
function newAssessment() {
  return {
    schema: 'triodian.aua.v1',
    engagement: { id: uid(), insurer: '', reference: '', counselFirm: '', privilegeMarking: '', startDate: '', briefConfirmed: { by: '', on: '', ref: '' }, documentsRequestedOn: '', independentReviewerReportsTo: 'counsel', irPersonId: '', irOrganisation: '', croPersonId: '', example: false, autosave: false, legalPhrases: C.legalPhrases.slice(), annexText: {}, annexSigned: { by: '', on: '' }, handBack: { by: '', on: '' } },
    people: [],
    calibration: { loaded: false, status: 'default', version: 0, date: '', approvedBy: '', agreedBy: '', privilegeMarking: '', minuteRef: '', fellBack: [], parameters: {} },
    documents: C.documents.map(d => ({ id: d.ref, ref: d.ref, title: d.name, status: '', date: '' })),
    interviews: C.interviews.map((v, i) => ({ id: 'IV-' + (i + 1), who: v.who, date: '', notesRef: '' })),
    arrangements: [], setAgreed: { gcBy: '', gcOn: '', counselBy: '', counselOn: '', on: '' },
    entries: [], questions: [], findings: [],
    reviews: C.reviews.map(r => ({ point: r.id, by: '', on: '', result: '', notes: '' })),
    exceptions: [], independentReviewPoints: [], r5Cleared: {}, diffReports: [], history: []
  };
}
function newEntry(arrId, id) {
  if (!id) { const n = S.entries.reduce((m, e) => Math.max(m, parseInt(String(e.id).slice(4), 10) || 0), 0) + 1; id = 'REG-' + String(n).padStart(3, '0'); }
  return { id, arrangementId: arrId, fields: {}, functionName: '', locEstablished: '', locRuns: '', authorityTests: [0, 1, 2, 3].map(() => ({ answer: null, source: '' })), tierProposed: '', tierOverrideReason: '', consequenceConfirmedBy: '', consequenceConfirmedOn: '', obtainability: { start: '', rungs: {} }, confChosen: '', confRaiseReason: '', peerReview: { personId: '', tier: '', differs: false, resolution: '', on: '' }, notDeterminable: { on: false, question: '', who: '', since: '' }, dl3Rows: [], classifiedBy: '', reviewedBy: '' };
}
function log(action, target, from, to) { REV++; S.history.push({ at: nowISO(), by: pname(UI.personId) || 'unknown', action, target, from: from === undefined ? null : from, to: to === undefined ? null : to }); UI.dirty = true; autosave(); }
function setFieldVal(e, n, patch) {
  const f = e.fields[n] || { value: '', source: '', notKnown: false, by: '', on: '' }, from = f.notKnown ? 'not known' : (patch.source !== undefined && patch.value === undefined ? 'source: ' + (f.source || '') : patch.detail !== undefined ? f.detail || '' : f.value);
  Object.assign(f, patch, { by: UI.personId, on: today() }); e.fields[n] = f;
  log('field ' + n, e.id, from, f.notKnown ? 'not known' : (patch.value !== undefined ? patch.value : patch.source !== undefined ? 'source: ' + patch.source : patch.detail !== undefined ? patch.detail : null));
}
function fieldDone(e, n) {
  n = +n; const f = e.fields[n];
  if (n === 1 || n === 2) return true;
  if (n === 17) return !!expected(e);
  if (n === 21) return obResult(e).done;
  if (n === 22) return obResult(e).none || !!confidence(e);
  if (n === 26) return !!finding(arr(e.arrangementId)).type;
  if (!f) return false; if (f.notKnown) return true;
  if (n === 15 || n === 16 || n >= 23) return !!f.value;
  return !!(f.value && String(f.value).trim() && f.source && f.source.trim());
}
const notKnownCount = e => Object.values(e.fields).filter(f => f && f.notKnown).length;

/* ---------- permissions ---------- */
/* One gate for every editable control and action. Returns '' when allowed, otherwise the reason shown beside the disabled control. */
function deny(target, x) {
  const p = me(); if (!p) return practice() || !SRV.user ? 'Choose who is acting under "Acting as" in the header.' : 'Your account has no role in this assessment. An administrator gives roles in Admin.';
  if (practice() === false && SRV.user && SRV.user.isAdmin && target === 'setup') return '';
  const r = k => p.roles.includes(k), tri = TRI.some(r);
  switch (target) {
    case 'setup': return r('methodOwner') || r('delivery') ? '' : 'Set-up and the people list are kept by the method owner or the delivery manager.';
    case 'set': return r('methodOwner') || r('assessor') || r('delivery') ? '' : 'Arrangements are recorded by the method owner, an assessor or the delivery manager.';
    case 'agreeGC': return r('gc') ? '' : 'Only the GC records the GC\u2019s agreement to the set.';
    case 'agreeCounsel': return r('counsel') ? '' : 'Only counsel records counsel\u2019s agreement to the set.';
    case 'facts': if (!(r('assessor') || r('methodOwner'))) return 'Facts are entered by an assessor or the method owner.'; if (x && x.peerReview && x.peerReview.personId === p.id) return 'You are the peer reviewer of this entry, so you cannot edit it.'; return '';
    case 'classify': if (!(r('assessor') || r('methodOwner'))) return 'Classification is done by an assessor or the method owner.'; if (x && x.peerReview && x.peerReview.personId === p.id) return 'You are the peer reviewer of this entry, so you cannot classify it.'; if (x && blindFor(x)) return 'Record your blind re-derivation (R3) first.'; return '';
    case 'consequence': return r('owner') ? '' : 'Only the arrangement owner confirms the failure consequence.';
    case 'peer': if (!r('peer')) return 'Only a peer reviewer re-derives the tier.'; if (x && x.classifiedBy === p.id) return 'You classified this entry, so you cannot review it.'; if (x && x.peerReview.personId && x.peerReview.personId !== p.id) return 'Another peer reviewer has recorded R3 for this entry.'; return '';
    case 'r2': return r('delivery') ? '' : 'R2 is run by the delivery manager.';
    case 'r4': if (!r('validation')) return 'R4 is recorded by a validation person.'; if (S.entries.some(e => e.classifiedBy === p.id || e.peerReview.personId === p.id)) return 'You classified or peer-reviewed an entry in the set, so you cannot validate it.'; return '';
    case 'r5': return r('methodOwner') ? '' : 'Legal-line hits and the phrase list are kept by the method owner.';
    case 'r6': return r('counsel') ? '' : 'R6 is recorded by counsel.';
    case 'r7': if (S.engagement.independentReviewerReportsTo === 'cro') return r('cro') && (!S.engagement.croPersonId || S.engagement.croPersonId === p.id) ? '' : 'With the reporting line directly to the CRO, the CRO named in set-up confirms R7.'; return r('ir') ? '' : 'With the reporting line through counsel, the independent reviewer confirms R7.';
    case 'irLog': return r('ir') ? '' : 'Review points are logged by the independent reviewer.';
    case 'irRespond': return tri ? '' : 'Triodian responds to review points.';
    case 'irClose': return r('ir') ? '' : 'Only the independent reviewer closes or discloses a review point.';
    case 'tri': return tri ? '' : 'Triodian records this.';
    case 'ask': return tri ? '' : 'Questions to counsel are raised by Triodian.';
    case 'answer': return r('counsel') || tri ? '' : 'Counsel enters the response, or Triodian transcribes it.';
    case 'annex': return r('methodOwner') ? '' : 'The method owner writes the annex.';
    case 'sign': if (!r('methodOwner')) return 'The method owner signs the annex.'; if (S.entries.some(e => e.peerReview.personId === p.id)) return 'You are the only peer reviewer of at least one entry, so you cannot sign the annex.'; return '';
    case 'handBack': return r('owner') ? '' : 'The hand-back list is accepted by the inventory owner (arrangement owner role).';
  }
  return '';
}
const ok = (t, x) => !deny(t, x);
const whyNote = why => why ? `<p class="small soft" style="margin:6px 0">${esc(why)} ${T('roleLimits', 'Why')}</p>` : '';
function pathTarget(path) {
  const k = path.split('.');
  if (k[0] === 'engagement') return k[1] === 'legalPhrasesText' ? ['r5'] : k[1] === 'annexText' ? ['annex'] : ['setup'];
  if (['people', 'documents', 'interviews'].includes(k[0])) return ['setup'];
  if (k[0] === 'arrangements') return k[2] === 'findingOwner' || k[2] === 'dl4Triggers' ? ['tri'] : ['set'];
  if (k[0] === 'entries') { const e = S.entries[+k[1]]; if (['tierOverrideReason', 'confChosen', 'confRaiseReason'].includes(k[2]) || (k[2] === 'fields' && k[3] === '16')) return ['classify', e]; if (k[2] === 'peerReview') return ['peer', e]; if (k[2] === 'dl3Rows') return ['tri']; return ['facts', e]; }
  if (k[0] === 'exceptions') return ['tri'];
  if (k[0] === 'independentReviewPoints') return k[2] === 'response' ? ['irRespond'] : k[2] === 'status' ? ['irClose'] : ['irLog'];
  return ['setup'];
}
/* R3 is blind: a peer reviewer who has not yet recorded a tier for an entry sees none of the classifier's work on it. */
const blindFor = e => { const p = me(); return !!(p && e && p.roles.includes('peer') && !e.peerReview.tier && e.classifiedBy !== p.id); };
const blindEntries = () => S.entries.filter(blindFor);
const tierShown = e => blindFor(e) ? '' : fv(e, 15);

/* ---------- classification rules ---------- */
function proposeTier(e) {
  let t = null; const up = x => { if (!t || rk(AT, x) > rk(AT, t)) t = x; };
  const h = fv(e, 12); if (h === 'acts') up('A1'); if (h === 'decides') up('A2');
  const a = e.authorityTests; if (a[0].answer === true) up('A3'); if (a[1].answer === true) up('A4'); if (a[2].answer === true) up('A5'); if (a[3].answer === true) up('A6');
  return t;
}
const cal = () => S.calibration.loaded ? S.calibration : null;
const P = k => cal() ? cal().parameters[k] : null;
function expected(e) {
  const t = fv(e, 15), c = fv(e, 16); if (!t || !c) return null;
  const p3 = P('P3');
  if (p3 && p3[t] && p3[t][c]) return { value: p3[t][c], basis: 'calibration', adjustment: `Calibration cell P3 ${t} × ${c}, ${cal().status} v${cal().version}` };
  const ai = rk(AT, t); let i = ai + 1, adj = 'Base rule, no adjustment';
  if (c === 'C1' && ai <= 1) { i -= 1; adj = `Base rule ${EV[ai + 1]}; C1 with ${t}: down one`; }
  else if ((c === 'C4' || c === 'C5') && ai <= 3) { i = Math.min(6, i + 1); adj = `Base rule ${EV[ai + 1]}; ${c} with ${t}: up one (proposed adjustment)`; }
  return { value: EV[i], basis: 'baseRule', adjustment: adj };
}
const rungLabel = () => cal() ? `Expected rung (P3, version ${cal().version})` : 'Indicative rung';
const e0Msg = () => `No evidence expected at this tier and consequence (P3, version ${cal() ? cal().version : '—'})`;
const rungWord = () => cal() ? 'expected rung' : 'indicative rung';
const stopRule = e => fv(e, 15) === 'A1' && fv(e, 16) === 'C1';
function ladder(e) { const ex = expected(e); if (!ex) return []; if (stopRule(e)) return ['E1']; if (ex.value === 'E0') return []; const out = []; for (let i = rk(EV, ex.value); i >= 1; i--) out.push(EV[i]); return out; }
function obResult(e) {
  const ex = expected(e); if (ex && ex.value === 'E0' && !stopRule(e)) return { rung: 'E0', done: true, current: null, none: true };
  const L = ladder(e), R = e.obtainability.rungs || {};
  if (!L.length) return { rung: null, done: false, current: null };
  for (const r of L) { const t = R[r] || {}; const ans = C.tests.map(x => t[x.id] ? t[x.id].pass : null);
    if (ans.every(a => a === true)) return { rung: r, done: true, current: null };
    if (ans.some(a => a === false)) continue;
    return { rung: null, done: false, current: r }; }
  return { rung: 'E0', done: true, current: null };
}
const needsRetest = e => { const ex = expected(e); if (!ex || stopRule(e)) return false; return !!(ex.value !== 'E0' && e.obtainability.start && e.obtainability.start !== ex.value); };
/* Confidence is proposed from the T1 source at the obtainable rung (section 7.4); the assessor may lower it, and raising it needs a reason. */
function proposedConfidence(e) {
  const ob = obResult(e); if (!ob.done || ob.none) return '';
  const src = ob.rung === 'E0' ? '' : String((((e.obtainability.rungs || {})[ob.rung] || {}).T1 || {}).source || '');
  const recv = S.documents.filter(d => d.status === 'received' && ['D7', 'D8', 'D9'].includes(d.ref) && d.id && src.toUpperCase().includes(String(d.id).toUpperCase()));
  let c = recv.length ? 'high' : /\bD\d+/i.test(src) ? 'medium' : 'low';
  if (fv(e, 3) === 'B2') { const f14 = e.fields[14], sup = (f14 && !f14.notKnown && /\bD\d+/i.test(String(f14.source || ''))) || recv.some(d => d.ref === 'D7'); if (!sup) c = 'low'; }
  return c;
}
const confRaisedNoReason = e => { const p = proposedConfidence(e); return !!(p && e.confChosen && rk(CONF, e.confChosen) > rk(CONF, p) && !String(e.confRaiseReason || '').trim()); };
function confidence(e) { const p = proposedConfidence(e); if (!p) return ''; const ch = e.confChosen; if (!ch || confRaisedNoReason(e)) return p; return ch; }
const bandOf = e => { const c = fv(e, 16); if (c) return band(c); const cs = S.entries.filter(x => x.arrangementId === e.arrangementId).map(x => fv(x, 16)).filter(Boolean); return cs.length ? band(cs.sort().pop()) : 'b45'; };
function f4Due(since, lim) {
  if (!lim) return '';
  const iso = String(lim).match(/\d{4}-\d{2}-\d{2}/); if (iso) return iso[0];
  const t = Date.parse(String(lim).split(';')[0]); if (!isNaN(t)) return new Date(t + 43200000).toISOString().slice(0, 10);
  const m = String(lim).match(/(\d+)\s*(day|week|month)/i); if (m && since) { const d = new Date(since); const n = +m[1], u = m[2].toLowerCase(); if (u === 'day') d.setDate(d.getDate() + n); else if (u === 'week') d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }
  return '';
}
function flags(e) {
  const out = []; if (!cal()) return out;
  const t = fv(e, 15), loc = fv(e, 4), c = fv(e, 16), fn = fnOf(e), p1 = P('P1'), p8 = P('P8'), p7 = P('P7'), p6 = P('P6');
  if (p1 && fn && p1[fn] && p1[fn][loc] && t) { const ceil = p1[fn][loc].tier; if (ceil && rk(AT, t) > rk(AT, ceil)) out.push({ id: 'aboveCeiling', label: `Above ceiling · ${t} over ${ceil}`, cls: 'b-red' }); }
  if (e.locEstablished || e.locRuns) {
    const p8f = n => p8 && (p8[n] || Object.values(p8).find(v => v && v.name && String(v.name).toLowerCase() === String(n).toLowerCase()));
    const m = (j, k) => !j ? null : (p8f(j) && p8f(j)[k]) || 'Escalate';
    const ms = [m(e.locEstablished, 'established'), m(e.locRuns, 'runs')].filter(Boolean);
    const worst = ms.includes('Not accepted') ? 'Not accepted' : ms.includes('Escalate') ? 'Escalate' : 'Accepted';
    if (worst === 'Not accepted') out.push({ id: 'location', label: 'Location not accepted', cls: 'b-red' }); else if (worst === 'Escalate') out.push({ id: 'location', label: 'Location · escalate', cls: 'b-ochre' });
  }
  const cf = confidence(e); if (p7 && c && cf && p7[band(c)] && rk(CONF, cf) < rk(CONF, String(p7[band(c)]).toLowerCase())) out.push({ id: 'belowConfidence', label: `Below minimum confidence (${p7[band(c)]})`, cls: 'b-red' });
  if (p6 && c && p6[band(c)]) { const lim = String(p6[band(c)].notKnown || ''); const n = parseInt(lim, 10); let over = false;
    if (!isNaN(n)) over = notKnownCount(e) > n; else if (/^none/i.test(lim)) over = [11, 12, 13].some(k => e.fields[k] && e.fields[k].notKnown);
    if (over) out.push({ id: 'notKnownOverLimit', label: 'Not known over limit (' + lim + ')', cls: 'b-ochre' }); }
  if (e.notDeterminable.on && p6) { const b = bandOf(e), due = f4Due(e.notDeterminable.since, p6[b] && p6[b].f4); if (due && today() > due) out.push({ id: 'f4TooLong', label: 'F4 standing too long (allowed to ' + due + ')', cls: 'b-ochre' }); }
  return out;
}
const f4Period = e => { const p6 = P('P6'); return p6 && p6[bandOf(e)] ? p6[bandOf(e)].f4 || '' : ''; };
function opOf(e) { const v = String(fv(e, 5) || ''); const m = v.match(/critical operation:\s*(.+)$/i); const op = m ? m[1] : (v.includes('·') ? v.split('·').pop() : ''); return /^\s*(none)?\s*$/i.test(op) ? '' : op.trim(); }
/* Concentration counts critical operations, not entries. Each unknown platform is its own unknown. */
function concentration() {
  const ops = {};
  S.entries.forEach(e => { const op = opOf(e); if (!op) return; const f9 = e.fields[9], pl = f9 && !f9.notKnown && f9.value && !/not known/i.test(f9.value) ? String(f9.value).trim() : null; const o = ops[op] = ops[op] || { pl: new Set(), unknown: [] }; if (pl) o.pl.add(pl); else o.unknown.push(e.id); });
  const names = Object.keys(ops); if (!names.length) return null;
  const by = {}; names.forEach(o => ops[o].pl.forEach(p => { by[p] = (by[p] || 0) + 1; }));
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0], lim = P('P9'), share = top ? Math.round(100 * top[1] / names.length) : 0;
  return { platform: top ? top[0] : null, share, ops: names.length, onTop: top ? top[1] : 0, unknowns: names.flatMap(o => ops[o].unknown.map(id => id + ' (' + o + ')')), limit: lim, over: lim != null && !!top && share > lim };
}
const qOrder = q => (q.respondedOn || '') + String(S.questions.indexOf(q)).padStart(5, '0');
const newest = list => list.slice().sort((a, b) => qOrder(b).localeCompare(qOrder(a)))[0];
/* F3 follows from counsel's recorded answers to questions 1 to 3 (all negative), or an explicit reach determination. The newest answer wins. */
function reachDetermination(a) {
  const qs = S.questions.filter(q => q.arrangementId === a.id && q.status === 'answered');
  const q = n => newest(qs.filter(x => +x.question7 === n && x.determination)), q1 = q(1), q2 = q(2), q3 = q(3);
  const ex = newest(qs.filter(x => x.reach));
  const set = [q1, q2, q3].filter(Boolean), setTop = set.length ? newest(set) : null;
  const neg = q1 && q2 && q3 && q1.determination === 'no' && q2.determination === 'no' && q3.determination === 'passive';
  if (ex && (!setTop || qOrder(ex) >= qOrder(setTop))) return ex.reach === 'none' ? { ref: ex.ref, basis: ex.response } : null;
  return neg ? { ref: [q1.ref, q2.ref, q3.ref].join(', '), basis: 'No nexus, no relationship and passive rights only (questions 1 to 3)' } : null;
}
function finding(a) {
  if (!a || a.missing || !a.id) return { type: null, label: 'No arrangement' };
  const es = S.entries.filter(e => e.arrangementId === a.id);
  if (!es.length) return { type: null, label: 'No entries' };
  const nd = es.find(e => e.notDeterminable.on);
  if (nd) return { type: 'F4', entry: nd.id, question: nd.notDeterminable.question, who: nd.notDeterminable.who };
  const nr = reachDetermination(a); if (nr) return { type: 'F3', ref: nr.ref, basis: nr.basis };
  if (es.some(e => !fv(e, 25))) return { type: null, label: 'Awaiting counsel', awaiting: true };
  if (es.some(e => !obResult(e).done)) return { type: null, label: 'Awaiting obtainability test', awaiting: true };
  let worst = null;
  es.forEach(e => { const req = fv(e, 25), ob = obResult(e).rung, gap = rk(EV, req) - rk(EV, ob); if (!worst || gap > worst.gap || (gap === worst.gap && rk(CO, fv(e, 16)) > rk(CO, fv(worst.e, 16)))) worst = { e, gap, req, ob }; });
  if (worst.gap <= 0) return { type: 'F1', entry: worst.e.id, required: worst.req, obtainable: worst.ob };
  const g = worst.gap >= 3 ? 'g3' : 'g' + worst.gap, b = band(fv(worst.e, 16)), p4 = P('P4');
  const priority = (p4 && p4[g] && p4[g][b]) || C.matrix[g][b];
  const R = worst.e.obtainability.rungs || {}, tested = R[worst.req] ? worst.req : ladder(worst.e)[0];
  const ft = C.tests.find(x => R[tested] && R[tested][x.id] && R[tested][x.id].pass === false);
  const failedTest = ft ? ft.id : '';
  const own = failedTest ? C.gapOwners[failedTest] : ['', []];
  const p5 = P('P5'), pp = p5 && p5[priority];
  return { type: 'F2', entry: worst.e.id, gap: worst.gap, required: worst.req, obtainable: worst.ob, priority, failedTest, owner: own[0], routes: own[1], due: pp ? pp.timeLimit || '' : '', interim: pp ? pp.interim || '' : '', priorityBasis: p4 ? 'P4' : 'framework matrix' };
}
const findingCls = t => ({ F1: 'b-green', F2: 'b-red', F3: 'b-slate', F4: 'b-ochre' }[t] || 'b-grey');
const findingName = t => (C.findings.find(f => f.code === t) || {}).name || '';
function brokenRefs() {
  const out = [], aid = new Set(S.arrangements.map(a => a.id)), eid = new Set(S.entries.map(e => e.id)), pid = new Set(S.people.map(p => p.id));
  const add = (item, ref, where) => out.push({ item, ref, where });
  S.entries.forEach(e => {
    if (!e.arrangementId) add(e.id, 'no arrangement (entry points to no arrangement)', 'Register entry'); else if (!aid.has(e.arrangementId)) add(e.id, 'arrangement ' + e.arrangementId, 'Register entry');
    Object.keys(e.fields).forEach(k => { if (FLD(k).missing) add(e.id, 'field ' + k, 'Register entry'); });
    [['classifiedBy', 'Classifier'], ['reviewedBy', 'Reviewer']].forEach(([k, w]) => { if (e[k] && !pid.has(e[k])) add(e.id, 'person ' + e[k], w); });
    if (e.peerReview.personId && !pid.has(e.peerReview.personId)) add(e.id, 'person ' + e.peerReview.personId, 'Peer reviewer');
  });
  S.questions.forEach(q => { if (q.arrangementId && !aid.has(q.arrangementId)) add(q.ref, 'arrangement ' + q.arrangementId, 'Question to counsel'); if (q.entryId && !eid.has(q.entryId)) add(q.ref, 'entry ' + q.entryId, 'Question to counsel'); if (q.owner && !pid.has(q.owner)) add(q.ref, 'person ' + q.owner, 'Question owner'); if (q.question7 === '' || q.question7 == null) add(q.ref, 'question number missing', 'Question to counsel'); });
  (S.loadNotes || []).forEach(n => out.push(Object.assign({ info: true }, n)));
  return out;
}

/* ---------- gates ---------- */
function coverage() { const bs = new Set(); S.arrangements.forEach(a => (a.boundaries || []).forEach(b => bs.add(b))); return { B1: bs.has('B1'), B2: bs.has('B2'), B3: bs.has('B3') }; }
function gates() {
  const e = S.engagement, g = [];
  g[0] = [['Brief confirmed by the GC', !!(e.briefConfirmed.on && e.briefConfirmed.by)], ['Privilege marking entered', !!String(e.privilegeMarking).trim()], ['Document request issued', !!e.documentsRequestedOn]];
  const cv = coverage(), exc = b => S.exceptions.some(x => (x.departure || '').includes(b));
  g[1] = [['Set agreed by the GC and by counsel (R1)', !!(S.setAgreed.gcBy && S.setAgreed.counselBy)], ...['B1', 'B2', 'B3'].map(b => [`${b} represented or recorded as an exception`, cv[b] || exc(b)])];
  const es = S.entries;
  g[2] = [['At least one register entry', es.length > 0], ['Fields 1 to 14 complete or not known, every value sourced (R2)', es.length > 0 && es.every(x => [3,4,5,6,7,8,9,10,11,12,13,14].every(n => fieldDone(x, n)))], ['No broken references', brokenRefs().filter(x => !x.info).length === 0]];
  g[3] = [['Fields 15 to 22 complete', es.length > 0 && es.every(x => [15,16,17,18,19,20,21,22].every(n => fieldDone(x, n)))], ['R3 differences resolved', es.length > 0 && es.every(x => x.peerReview.tier && (!x.peerReview.differs || String(x.peerReview.resolution || '').trim()))], ['R4 validation passed', rev('R4').result === 'passed']];
  g[4] = [['Every question answered or open with an owner', S.questions.every(q => q.status === 'answered' || (q.status === 'openWithOwner' && q.owner))]];
  g[5] = [['Every arrangement has a finding or is awaiting counsel', S.arrangements.length > 0 && S.arrangements.every(a => { const f = finding(a); return f.type || f.awaiting; })], ['R5 legal-line check cleared', r5Clear()], ['R6 counsel review recorded', !!rev('R6').on]];
  g[6] = [['R7 independent check complete', rev('R7').result === 'complete']];
  g[7] = [['Hand-back list accepted', !!(e.handBack.by && e.handBack.on)]];
  return g.map(items => ({ ok: items.every(i => i[1]), items }));
}
const rev = id => S.reviews.find(r => r.point === id) || { point: id, by: '', on: '', result: '', notes: '' };

/* ---------- file validation ---------- */
function capWalk(v, p, E, depth) { depth = depth || 0; if (depth > 14) return E(p, 'nested too deeply'); if (typeof v === 'string') { if (v.length > 10000) E(p, 'longer than 10,000 characters'); } else if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (k.length > 200) E(p, 'a key is longer than 200 characters'); capWalk(v[k], p + '.' + k, E, depth + 1); }); }
function validateFile(o) {
  const err = [], E = (p, m) => err.push(p + ': ' + m), roles = C.roles.map(r => r.id);
  const id = (v, p) => { if (v == null || v === '') return; if (typeof v !== 'string' || !IDRE.test(v)) E(p, 'not a valid id or reference'); };
  const inList = (v, list, p, what) => { if (v == null || v === '') return; if (!list.includes(v)) E(p, `"${String(v).slice(0, 40)}" is not ${what}`); };
  const arrOf = (v, p) => { if (v != null && !Array.isArray(v)) { E(p, 'must be a list'); return []; } return v || []; };
  capWalk(o, 'file', E);
  const strOrNull = (v, p) => { if (v != null && typeof v !== 'string') E(p, 'must be text'); };
  ['documents', 'interviews', 'arrangements', 'entries', 'questions', 'findings', 'reviews', 'exceptions', 'independentReviewPoints', 'diffReports', 'history', 'people'].forEach(k => arrOf(o[k], k));
  const en = o.engagement || {}; id(en.id, 'engagement.id');
  if (en.legalPhrases != null) arrOf(en.legalPhrases, 'engagement.legalPhrases').forEach((x, i) => { if (typeof x !== 'string') E('engagement.legalPhrases.' + i, 'must be text'); }); ['irPersonId', 'croPersonId'].forEach(k => id(en[k], 'engagement.' + k)); id((en.briefConfirmed || {}).by, 'engagement.briefConfirmed.by');
  inList(en.independentReviewerReportsTo, ['counsel', 'cro'], 'engagement.independentReviewerReportsTo', 'a reporting line');
  arrOf(o.people, 'people').forEach((p, i) => { id(p.id, `people.${i}.id`); arrOf(p.roles, `people.${i}.roles`).forEach((r, j) => inList(r, roles, `people.${i}.roles.${j}`, 'a known role')); });
  arrOf(o.documents, 'documents').forEach((d, i) => { id(d.id, `documents.${i}.id`); id(d.ref, `documents.${i}.ref`); inList(d.status, ['requested', 'received', 'notHeld'], `documents.${i}.status`, 'a document status'); });
  arrOf(o.interviews, 'interviews').forEach((v, i) => id(v.id, `interviews.${i}.id`));
  arrOf(o.arrangements, 'arrangements').forEach((a, i) => { id(a.id, `arrangements.${i}.id`); arrOf(a.boundaries, `arrangements.${i}.boundaries`).forEach((b, j) => inList(b, ['B1', 'B2', 'B3'], `arrangements.${i}.boundaries.${j}`, 'a boundary')); arrOf(a.criteria, `arrangements.${i}.criteria`).forEach((c, j) => inList(String(c), ['1', '2', '3', '4', '5', '6'], `arrangements.${i}.criteria.${j}`, 'a criterion')); arrOf(a.dl4Triggers, `arrangements.${i}.dl4Triggers`).forEach((r, j) => id(r, `arrangements.${i}.dl4Triggers.${j}`)); });
  const sa = o.setAgreed || {}; ['gcBy', 'counselBy'].forEach(k => id(sa[k], 'setAgreed.' + k));
  arrOf(o.entries, 'entries').forEach((e, i) => {
    const p = 'entries.' + i; id(e.id, p + '.id'); id(e.arrangementId, p + '.arrangementId'); ['classifiedBy', 'reviewedBy'].forEach(k => id(e[k], p + '.' + k));
    if (e.fields != null && (typeof e.fields !== 'object' || Array.isArray(e.fields))) E(p + '.fields', 'must be an object');
    arrOf(e.authorityTests, p + '.authorityTests').forEach((t, j) => { if (!t || typeof t !== 'object') E(`${p}.authorityTests.${j}`, 'must be an object'); else strOrNull(t.source, `${p}.authorityTests.${j}.source`); });
    arrOf(e.dl3Rows, p + '.dl3Rows').forEach((r, j) => { if (!r || typeof r !== 'object') E(`${p}.dl3Rows.${j}`, 'must be an object'); else { strOrNull(r.category, `${p}.dl3Rows.${j}.category`); strOrNull(r.record, `${p}.dl3Rows.${j}.record`); } });
    ['tierOverrideReason', 'confRaiseReason', 'functionName', 'locEstablished', 'locRuns'].forEach(k => strOrNull(e[k], p + '.' + k));
    Object.entries(e.fields || {}).forEach(([k, f]) => { const fp = `${p}.fields.${k}`; if (!/^\d{1,2}$/.test(k)) E(fp, 'field key must be a number'); if (!f || typeof f !== 'object') return E(fp, 'must be an object'); id(f.by, fp + '.by'); id(f.transcribedBy, fp + '.transcribedBy'); strOrNull(f.value, fp + '.value'); strOrNull(f.source, fp + '.source'); strOrNull(f.detail, fp + '.detail');
      const def = C.fields.find(x => String(x.n) === k); if (def && def.kind.startsWith('select:') && !f.notKnown && f.value) inList(f.value, def.kind.slice(7).split('|'), fp, 'one of the allowed values');
      if (!f.notKnown && f.value) { if (k === '15') inList(f.value, AT, fp, 'a tier A1 to A6'); if (k === '16') inList(f.value, CO, fp, 'a consequence C1 to C5'); if (k === '18') inList(f.value, EV.concat(['none']), fp, 'a rung E0 to E6'); if (k === '25') inList(f.value, EV, fp, 'a rung E0 to E6'); } });
    if (e.peerReview) { id(e.peerReview.personId, p + '.peerReview.personId'); inList(e.peerReview.tier, AT, p + '.peerReview.tier', 'a tier A1 to A6'); }
    inList(e.tierProposed, AT, p + '.tierProposed', 'a tier A1 to A6');
    Object.entries((e.obtainability || {}).rungs || {}).forEach(([r, t]) => { inList(r, EV, `${p}.obtainability.rungs.${r}`, 'a rung E0 to E6'); Object.keys(t || {}).forEach(k => inList(k, TESTS, `${p}.obtainability.rungs.${r}.${k}`, 'a test T1 to T5')); });
    inList((e.obtainability || {}).start, EV, p + '.obtainability.start', 'a rung E0 to E6');
    inList(e.confChosen, CONF, p + '.confChosen', 'a confidence level');
  });
  arrOf(o.questions, 'questions').forEach((q, i) => { const p = 'questions.' + i; id(q.ref, p + '.ref'); id(q.arrangementId, p + '.arrangementId'); id(q.entryId, p + '.entryId'); id(q.owner, p + '.owner'); id(q.transcribedBy, p + '.transcribedBy'); id(q.enteredBy, p + '.enteredBy');
    ['facts', 'question', 'why', 'response'].forEach(k => strOrNull(q[k], p + '.' + k)); if (q.question7 != null && q.question7 !== '') inList(String(q.question7), ['1', '2', '3', '4', '5', '6', '7'], p + '.question7', 'one of the seven questions'); inList(q.status, ['open', 'answered', 'openWithOwner'], p + '.status', 'a question status'); inList(q.targetField ? String(q.targetField) : '', ['23', '24', '25'], p + '.targetField', 'field 23, 24 or 25'); inList(q.determination, ['yes', 'no', 'passive', 'significant', 'contractual', 'control'], p + '.determination', 'a determination'); inList(q.reach, ['none', 'reach'], p + '.reach', 'a reach determination'); });
  arrOf(o.findings, 'findings').forEach((f, i) => inList(f.type, ['F1', 'F2', 'F3', 'F4'], `findings.${i}.type`, 'a finding F1 to F4'));
  arrOf(o.reviews, 'reviews').forEach((r, i) => { inList(r.point, ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'], `reviews.${i}.point`, 'a review point'); id(r.by, `reviews.${i}.by`); });
  arrOf(o.exceptions, 'exceptions').forEach((x, i) => { id(x.ref, `exceptions.${i}.ref`); id(x.approvedBy, `exceptions.${i}.approvedBy`); });
  arrOf(o.independentReviewPoints, 'independentReviewPoints').forEach((x, i) => { id(x.ref, `independentReviewPoints.${i}.ref`); inList(x.status, ['open', 'closed', 'disclosed'], `independentReviewPoints.${i}.status`, 'a review point status'); });
  const cb = o.calibration || {}; if (cb.fellBack != null) arrOf(cb.fellBack, 'calibration.fellBack').forEach((x, i) => { if (typeof x !== 'string') E('calibration.fellBack.' + i, 'must be text'); });
  if (o.r5Cleared != null && (typeof o.r5Cleared !== 'object' || Array.isArray(o.r5Cleared))) E('r5Cleared', 'must be an object');
  if (o.calibration && o.calibration.loaded) { const w = validateCalibration(Object.assign({ schema: 'triodian.raf.calibration.v1' }, o.calibration)); if (w) E('calibration', w); }
  return err[0] || '';
}
function validateCalibration(o) {
  if (!o || o.schema !== 'triodian.raf.calibration.v1') return 'Not a calibration set (schema triodian.raf.calibration.v1 expected).';
  const err = [], E = (p, m) => err.push(p + ': ' + m);
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v), str = v => v == null || typeof v === 'string';
  const key = (k, p) => { if (!/^[^<>"'&]{1,120}$/.test(k)) E(p, 'invalid key'); };
  capWalk(o, 'file', E);
  if (!['default', 'working', 'approved'].includes(o.status)) E('status', 'unknown status');
  if (typeof o.version !== 'number' || o.version < 0 || o.version % 1) E('version', 'not a whole number');
  const Q = o.parameters; if (!isObj(Q)) return err[0] || 'parameters: missing.';
  if (Q.P1 != null) { if (!isObj(Q.P1)) E('parameters.P1', 'must be an object'); else Object.entries(Q.P1).forEach(([fn, locs]) => { key(fn, 'parameters.P1'); if (!isObj(locs)) return E('parameters.P1.' + fn, 'must be an object'); Object.entries(locs).forEach(([l, v]) => { const p = `parameters.P1.${fn}.${l}`; if (!['own', 'provider', 'platform'].includes(l)) E(p, 'unknown location'); if (v != null) { if (!isObj(v) || !AT.includes(v.tier)) E(p, 'tier must be A1 to A6'); else if (!str(v.condition)) E(p + '.condition', 'must be text'); } }); }); }
  if (Q.P2 != null && Q.P2 !== 'generic') { if (!isObj(Q.P2)) E('parameters.P2', 'must be an object'); else Object.entries(Q.P2).forEach(([k, v]) => { if (!/^C[2-5]\b/.test(k)) E('parameters.P2.' + k, 'key must start with C2 to C5'); if (!str(v)) E('parameters.P2.' + k, 'must be text'); }); }
  if (!isObj(Q.P3)) E('parameters.P3', 'missing'); else AT.forEach(a => CO.forEach(c => { const v = Q.P3[a] && Q.P3[a][c]; if (!EV.includes(v)) E(`parameters.P3.${a}.${c}`, `"${String(v).slice(0, 20)}" is not a rung E0 to E6`); }));
  if (Q.P4 != null) ['g1', 'g2', 'g3'].forEach(g => BANDS.forEach(b => { const v = Q.P4[g] && Q.P4[g][b]; if (!PRI.includes(v)) E(`parameters.P4.${g}.${b}`, 'must be Low, Medium or High'); }));
  if (Q.P5 != null) { if (!isObj(Q.P5)) E('parameters.P5', 'must be an object'); else Object.entries(Q.P5).forEach(([k, v]) => { if (!PRI.includes(k)) E('parameters.P5.' + k, 'unknown priority'); if (!isObj(v) || !str(v.timeLimit) || !str(v.interim)) E('parameters.P5.' + k, 'needs a time limit and an interim position'); }); }
  if (Q.P6 != null) { if (!isObj(Q.P6)) E('parameters.P6', 'must be an object'); else Object.entries(Q.P6).forEach(([k, v]) => { if (!BANDS.includes(k)) E('parameters.P6.' + k, 'unknown band'); if (!isObj(v) || !str(v.notKnown) || !str(v.f4)) E('parameters.P6.' + k, 'needs a not-known limit and an F4 period'); }); }
  if (Q.P7 != null) { if (!isObj(Q.P7)) E('parameters.P7', 'must be an object'); else Object.entries(Q.P7).forEach(([k, v]) => { if (!BANDS.includes(k)) E('parameters.P7.' + k, 'unknown band'); if (v != null && !['Low', 'Medium', 'High'].includes(v)) E('parameters.P7.' + k, 'must be Low, Medium or High'); }); }
  if (Q.P8 != null) { if (!isObj(Q.P8)) E('parameters.P8', 'must be an object'); else Object.entries(Q.P8).forEach(([k, v]) => { key(k, 'parameters.P8'); if (!isObj(v) || !MARKS.includes(v.established) || !MARKS.includes(v.runs)) E('parameters.P8.' + k, 'established and runs must be Accepted, Escalate or Not accepted'); else if (!str(v.name)) E('parameters.P8.' + k + '.name', 'must be text'); }); }
  if (Q.P9 != null && (typeof Q.P9 !== 'number' || isNaN(Q.P9) || Q.P9 < 0 || Q.P9 > 100)) E('parameters.P9', 'must be a percentage from 0 to 100');
  if (Q.P10 != null) { if (!Array.isArray(Q.P10)) E('parameters.P10', 'must be a list'); else Q.P10.forEach((t, i) => { if (!isObj(t) || !IDRE.test(String(t.ref || ''))) return E('parameters.P10.' + i, 'needs a valid ref'); ['trigger', 'measure', 'threshold', 'recipient'].forEach(f => { if (!str(t[f])) E(`parameters.P10.${i}.${f}`, 'must be text'); }); if (t.hours != null && typeof t.hours !== 'number') E(`parameters.P10.${i}.hours`, 'must be a number'); }); }
  if (Q.P11 != null) { if (!isObj(Q.P11) || !Array.isArray(Q.P11.events) || !str(Q.P11.interval)) E('parameters.P11', 'needs a list of events and an interval'); else Q.P11.events.forEach((ev, i) => { if (!isObj(ev) || !str(ev.event) || !str(ev.revisit)) E('parameters.P11.events.' + i, 'needs an event and what is revisited'); }); }
  if (o.fellBackToDefault != null && !Array.isArray(o.fellBackToDefault)) E('fellBackToDefault', 'must be a list');
  return err[0] || '';
}

/* ---------- calibration exchange ---------- */
function snapshot() {
  return { e: Object.fromEntries(S.entries.map(e => [e.id, { exp: (expected(e) || {}).value || '—', flags: flags(e).map(f => f.label).join('; ') || 'none' }])), a: Object.fromEntries(S.arrangements.map(a => { const f = finding(a); return [a.id, [f.type || f.label || '—', f.priority, f.due].filter(Boolean).join(' · ')]; })) };
}
function loadCalibration(o, confirmed) {
  const why = validateCalibration(o); if (why) { toast('Rejected · ' + why); return false; }
  if (cal() && o.version < cal().version && !confirmed && !confirm(`This calibration set is version ${o.version} (${o.status}). Version ${cal().version} (${cal().status}) is in use.\n\nLoad the older version?`)) return false;
  const before = snapshot(), from = cal() ? `${cal().status} v${cal().version}` : 'uncalibrated', oldP = cal() ? cal().parameters : null;
  S.calibration = { loaded: true, status: o.status, version: o.version, date: o.date || '', approvedBy: o.approvedBy || '', agreedBy: o.agreedBy || '', privilegeMarking: o.privilegeMarking || '', minuteRef: o.minuteRef || '', fellBack: o.fellBackToDefault || [], parameters: o.parameters };
  const changedP = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'].filter(k => JSON.stringify((oldP || {})[k] == null ? null : oldP[k]) !== JSON.stringify(o.parameters[k] == null ? null : o.parameters[k]));
  const list = ks => { const c = changedP.filter(k => ks.includes(k)); return c.length ? 'Changed: ' + c.join(', ') : oldP ? 'Follows from the expected rung change' : 'Calibration set loaded where none was in use'; };
  const after = snapshot(), changes = [];
  Object.keys(after.e).forEach(id => { const b = before.e[id], a = after.e[id], e = ent(id), t = fv(e, 15), c = fv(e, 16);
    if (b.exp !== a.exp) { const ov = oldP && oldP.P3 && oldP.P3[t] ? oldP.P3[t][c] : null; changes.push({ item: id, what: 'Expected rung', from: b.exp, to: a.exp, why: (oldP ? `P3 ${t} × ${c} changed from ${ov || 'the base rule'} to ${o.parameters.P3[t][c]}` : `P3 ${t} × ${c} (${o.parameters.P3[t][c]}) replaces the base rule`) + (e.obtainability.start ? '; obtainability test marked for re-test' : '') }); }
    if (b.flags !== a.flags) changes.push({ item: id, what: 'Flags', from: b.flags, to: a.flags, why: list(['P1', 'P6', 'P7', 'P8']) }); });
  Object.keys(after.a).forEach(id => { if (before.a[id] !== after.a[id]) changes.push({ item: id, what: 'Finding', from: before.a[id], to: after.a[id], why: list(['P3', 'P4', 'P5']) }); });
  S.diffReports.push({ at: nowISO(), from, to: `${o.status} v${o.version}`, changedParameters: changedP, changes });
  log('loadCalibration', 'calibration', from, `${o.status} v${o.version}`); return true;
}
function registerExtract() {
  return { privilegeMarking: S.engagement.privilegeMarking || null, schema: 'triodian.aua.extract.v1', generated: nowISO(), calibration: cal() ? `${cal().status} v${cal().version}` : 'uncalibrated', entries: S.entries.map(e => { const r = fv(e, 18); return { function: fnOf(e) || null, location: fv(e, 4) || null, tier: fv(e, 15) || null, consequence: fv(e, 16) || null, received: r === 'none' ? 'E0' : /^E\d$/.test(r) ? r : null }; }) };
}
const calLabel = () => cal() ? (cal().status === 'approved' ? `Approved appetite, version ${cal().version}, ${cal().date}${cal().minuteRef ? ' · minute ' + cal().minuteRef : ''}` : `${cal().status === 'working' ? 'Working' : 'Default'} appetite, version ${cal().version}`) : 'Uncalibrated: framework defaults apply';

/* ---------- shell ---------- */
const MARKSVG = () => (C.markSvg || '').replace('<svg', '<svg aria-hidden="true" focusable="false"');
const badge = (l, c) => `<span class="badge ${c}">${esc(l)}</span>`;
const gate = (ok, t) => `<span class="gate ${ok ? 'ok' : 'no'}" role="status"><i></i>${esc(t)}</span>`;
const SEQ = ['setup','overview','set','register','classify','counsel','findings','review','outputs'];
const SNAME = { setup: 'Set-up', overview: 'Overview', set: 'Set', register: 'Register', classify: 'Classify', counsel: 'Counsel', findings: 'Findings', review: 'Review', outputs: 'Outputs', reference: 'Reference' };
function calBadge() { const c = cal(); return c ? badge(c.status === 'approved' ? 'approved v' + c.version : c.status === 'working' ? 'working v' + c.version : 'default v' + c.version, c.status === 'approved' ? 'b-green' : 'b-ochre') : badge('uncalibrated', 'b-grey'); }
function personSelect(id) { return `<select id="${id}" data-act="person" aria-label="Acting as"><option value="">Choose person</option>${S.people.map(p => `<option value="${esc(p.id)}" ${UI.personId === p.id ? 'selected' : ''}>${esc(p.name || 'Unnamed')} · ${esc(p.roles.map(r => roleName(r).replace(/ \(.*\)/, '')).join(', ') || 'no role')}</option>`).join('')}</select>`; }
function header() {
  const b = bp(), steps = ['setup','set','register','classify','counsel','findings','review','outputs'];
  return `<header class="hdr"><div class="hdr-in">
    <button class="brand" data-act="go" data-to="overview" aria-label="Triodian · go to overview">${b !== 'phone' ? LOGO(22) : MARKSVG()}</button>
    ${b !== 'phone' ? '<span class="vrule" aria-hidden="true"></span>' : ''}<span class="apptitle">AI Use Assessment</span>
    ${b === 'desk' ? `<nav class="steps" aria-label="Steps">${steps.map(s => `<button data-act="go" data-to="${s}" ${UI.screen === s ? 'aria-current="page"' : ''}>${SNAME[s]}</button>`).join('')}</nav>` : ''}
    <div class="hdr-r">${saveChip()}
      ${b !== 'phone' ? `<button class="checkcount" style="border:0;padding:0" data-act="go" data-to="setup" aria-label="Calibration status">${calBadge()}</button>` : ''}
      ${b !== 'phone' && (practice() || !SRV.user) ? `<label class="chip" title="Practice only: choose whose view to try"><span aria-hidden="true">⌾</span>${personSelect('who-hdr')}</label>` : ''}
      ${account()}<button class="iconbtn" data-act="drawer" aria-label="Menu" aria-expanded="${UI.drawer}">☰</button></div></div></header>
    ${SRV.site ? `<div class="examplebar" style="background:#FDF0E1;color:#8A4B08;border-color:#F0D2AE">${esc(SRV.site)} · for trying things out · not the live assessment</div>` : ''}
    ${S.engagement.example ? `<div class="examplebar">Worked example · fictional insurer and arrangements · practice only, nothing is saved${SRV.on ? ' · <button class="lnk" data-act="leaveExample">Back to the assessment</button>' : ''}</div>` : ''}
    ${cal() ? '' : '<div class="examplebar" style="background:var(--grey-bg);color:var(--grey);border-color:var(--rule)">Uncalibrated: framework defaults apply</div>'}
    ${blindEntries().length ? `<div class="examplebar" style="background:var(--aubergine-bg);color:var(--aubergine);border-color:#D9CFE0">Blind re-derivation · the classifier's work is hidden for ${esc(blindEntries().map(e => e.id).join(', '))} until you record R3</div>` : ''}`;
}
function drawer() {
  if (!UI.drawer) return '';
  const it = (to, label) => `<button class="item" data-act="go" data-to="${to}" ${UI.screen === to ? 'aria-current="page"' : ''}>${label}</button>`;
  return `<div class="drawer-bg" data-act="drawer"></div><aside class="drawer" role="dialog" aria-label="Menu">
    <div class="row between"><strong>Menu</strong><button class="iconbtn" data-act="drawer" aria-label="Close menu">✕</button></div>
    <div class="grp">Steps</div>${SEQ.map(s => it(s, SNAME[s])).join('')}${it('reference', 'Reference')}
    ${practice() || !SRV.user ? `<div class="grp">Acting as · practice</div><label class="chip" style="width:100%"><span aria-hidden="true">⌾</span>${personSelect('who-drw')}</label>` : ''}
    <div class="row" style="margin-top:8px">${calBadge()}</div>
    <div class="grp">Practice</div>
    ${practice() ? (SRV.on ? '<button class="item" data-act="leaveExample">Leave the worked example</button>' : '') : '<button class="item" data-act="example">Open the worked example</button>'}
    <p class="small soft" style="padding:0 10px">The worked example is fictional and runs in this browser only. Nothing in it is saved.</p>
    <div class="grp">Apps</div>
    <a class="item" href="${appetiteUrl()}" style="text-decoration:none"><span class="appic" style="background:var(--aubergine-bg);color:var(--aubergine)">RA</span><span>AI Risk Appetite<br><span class="small soft">Sets the calibration set this app reads</span></span></a>
    <div class="item" aria-current="page"><span class="appic" style="background:#E3E9EF;color:var(--navy)">UA</span><span>AI Use Assessment<br><span class="small soft">Register, tests and findings</span></span><span class="badge b-green" style="margin-left:auto">now</span></div>
  </aside>`;
}
function footer() {
  return `<footer class="ft"><div class="wrap"><div class="scope" role="note"><span aria-hidden="true">⚠</span><span><strong>Scope.</strong> ${esc(C.banner)}</span></div>
    <div class="ftrow"><span class="row" style="gap:8px;color:var(--aubergine)">${MARKSVG().replace('<svg', '<svg width="20" height="19"')}<span style="color:var(--ink);font-weight:600">Triodian</span><span class="mono soft">Framework ${esc(C.frameworkDate)}</span></span>
    <span class="row"><button class="lnk" data-act="go" data-to="reference">Reference</button><span class="mono">${esc(calLabel())}</span></span></div></div></footer>`;
}
function appetiteUrl() { return SRV.site ? 'https://risk-appetite-test.triodian.com/' : 'https://risk-appetite.triodian.com/'; }
function entryStatus() {
  const box = t => `<div class="panel2" role="status" style="padding:12px 14px;margin:14px 0 4px">${t}</div>`;
  if (!SRV.checked) return box('Connecting…');
  if (SRV.code === 'no_access') return box(`<strong>You don't have access yet.</strong> ${esc(SRV.reason)} You can still open the worked example.`);
  if (!SRV.on) return box(`<strong>The server could not be reached.</strong> ${esc(SRV.reason || '')} Reload the page to try again. The worked example works without it.`);
  if (!canSetup()) return box(`<strong>The assessment has not been started yet.</strong> The method owner or the delivery manager starts it. ${(SRV.user.roles || []).length ? '' : 'Your account has no role in it yet; an administrator gives roles in Admin.'}`);
  return '';
}
function entryOverlay() {
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="entry-h"><div class="entry" style="border-top-color:var(--navy)">
    <div class="row" style="gap:10px;color:var(--aubergine);margin-bottom:22px">${MARKSVG().replace('<svg', '<svg width="30" height="28"')}<span class="wordmark">Triodian</span><span class="vrule"></span><span style="font-weight:600">AI Use Assessment</span></div>
    <div class="eyebrow">What the documents show, at each boundary</div>
    <h1 id="entry-h" class="h1" style="font-size:32px">Map the AI. Test what evidence can reach the insurer.</h1>
    <p class="soft">Eight phases from set-up to close. One register entry for each place AI acts, seven questions, one obtainability test per rung, one finding per arrangement.</p>
    ${entryStatus()}
    <div class="acts">
      ${SRV.on && canSetup() ? `<button class="act" data-act="new"><span class="mono" style="color:var(--navy)">01</span><span><strong>Start the assessment</strong><br><span class="small soft">Begin at set-up. Everyone with a role then works on the same assessment.</span></span></button>` : ''}
      <button class="act" data-act="example"><span class="mono" style="color:var(--navy)">${SRV.on && canSetup() ? '02' : '01'}</span><span><strong>Open the worked example</strong><br><span class="small soft">Practice on the framework's illustration: an outside claims manager whose triage model routes motor claims. Fictional, and never saved.</span></span></button>
    </div>${SRV.user ? `<p class="small soft" style="margin-top:16px">Signed in as ${esc(SRV.user.email)} · <a href="/profile/">Your profile</a>${SRV.user.isAdmin ? ' · <a href="/admin/">Admin</a>' : ''} · <a href="/cdn-cgi/access/logout">Sign out</a></p>` : ''}<div class="scope" style="margin-top:22px"><span aria-hidden="true">⚠</span><span>${esc(C.banner)}</span></div></div></div>`;
}
const opening = (eb, h1, sub) => `<div class="opening"><div class="eyebrow">${eb}</div><h1 class="h1">${h1}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
function seqNav() { const i = SEQ.indexOf(UI.screen); return i < 0 ? {} : { prev: SEQ[i - 1], next: SEQ[i + 1] }; }
function stepbar(g) { const n = seqNav(); return `<div class="stepbar">${n.prev ? `<button class="btn" data-act="go" data-to="${n.prev}">← ${SNAME[n.prev]}</button>` : '<span></span>'}${g || ''}${n.next ? `<button class="btn primary" data-act="go" data-to="${n.next}">${SNAME[n.next]} →</button>` : '<span></span>'}</div>`; }
function bottombar(g) { if (bp() !== 'phone' || SEQ.indexOf(UI.screen) < 0) return ''; const n = seqNav(); return `<nav class="bottombar" aria-label="Step">${n.prev ? `<button class="btn" data-act="go" data-to="${n.prev}" aria-label="Previous: ${SNAME[n.prev]}">←</button>` : '<span style="width:44px"></span>'}${g || ''}${n.next ? `<button class="btn primary" data-act="go" data-to="${n.next}" aria-label="Next: ${SNAME[n.next]}">→</button>` : '<span style="width:44px"></span>'}</nav>`; }
/* Every path-bound control asks deny() first; the reason is the control's tooltip and is shown beside the card. */
function fld(label, path, value, o) {
  o = o || {}; const id = 'f_' + path.replace(/[^a-zA-Z0-9]/g, '_'), pt = pathTarget(path), why = o.disabled === true ? 'locked' : deny(pt[0], pt[1]), dis = why ? `disabled title="${esc(why)}"` : '';
  const ctl = o.select ? `<select class="in" id="${id}" data-path="${esc(path)}" ${dis}>${o.select.map(x => `<option value="${esc(x[0])}" ${String(value) === String(x[0]) ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`
    : o.area ? `<textarea class="in" id="${id}" data-path="${esc(path)}" placeholder="${esc(o.ph || '')}" ${dis}>${esc(value)}</textarea>`
    : `<input class="in" id="${id}" data-path="${esc(path)}" type="${o.type || 'text'}" value="${esc(value)}" placeholder="${esc(o.ph || '')}" ${dis}>`;
  return `<label class="f" for="${id}"><span>${o.raw ? label : esc(label)}</span>${ctl}</label>`;
}
const peopleOpts = (role, blank) => [['', blank || '—'], ...S.people.filter(p => !role || p.roles.includes(role)).map(p => [p.id, p.name])];
const gateCard = (n) => { const g = gates()[n]; return `<section class="card" style="margin-top:18px"><h2 class="sh">Phase ${n} exit gate</h2><div class="stack" style="gap:6px">${g.items.map(i => gate(i[1], i[0])).join('')}</div></section>`; };

/* ---------- S1 set-up ---------- */
function screenSetup() {
  const e = S.engagement, b = bp(), c = cal(), why = deny('setup'), fs = why ? 'disabled' : '';
  const people = savesHere() ? S.people.map(p => `<div class="panel2" style="padding:12px 16px"><strong>${esc(p.name || 'Unnamed')}</strong>${p.organisation ? ` <span class="soft">· ${esc(p.organisation)}</span>` : ''}<div class="small soft" style="margin-top:4px">${esc(p.roles.map(roleName).join(', '))}</div></div>`).join('') : S.people.map((p, i) => `<div class="panel2" style="padding:14px 16px"><div class="fgrid">${fld('Name', `people.${i}.name`, p.name)}${fld('Organisation', `people.${i}.organisation`, p.organisation)}</div>
    <div class="mini" style="margin:10px 0 4px">ROLES · one person may hold more than one Triodian role</div><div class="row" style="gap:4px 14px">${C.roles.map(r => `<label class="cb small"><input type="checkbox" id="role-${i}-${r.id}" data-arrchk="people.${i}.roles" value="${r.id}" ${p.roles.includes(r.id) ? 'checked' : ''} ${fs}>${esc(r.name)}</label>`).join('')}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn sm ghost" data-act="rmPerson" data-i="${i}" ${fs}>Remove</button></div></div>`).join('');
  const st = [['', '—'], ['requested', 'Requested'], ['received', 'Received'], ['notHeld', 'Not held']], refs = [['', '—'], ...C.documents.map(x => [x.ref, x.ref])];
  const docs = S.documents.map((d, i) => b === 'phone'
    ? `<div class="panel2" style="padding:12px"><div class="fgrid">${fld('ID', `documents.${i}.id`, d.id)}${fld('Ref', `documents.${i}.ref`, d.ref, { select: refs })}${fld('Title', `documents.${i}.title`, d.title)}${fld('Status', `documents.${i}.status`, d.status, { select: st })}${fld('Date', `documents.${i}.date`, d.date, { type: 'date' })}</div></div>`
    : `<tr><td><input class="in mono" id="doc-${i}-id" data-path="documents.${i}.id" value="${esc(d.id)}" aria-label="Document ID" style="width:120px" ${fs}></td><td><select class="in" id="doc-${i}-ref" data-path="documents.${i}.ref" aria-label="Ref" ${fs}>${refs.map(o => `<option value="${o[0]}" ${d.ref === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></td><td><input class="in" id="doc-${i}-title" data-path="documents.${i}.title" value="${esc(d.title)}" aria-label="Title" ${fs}></td><td><select class="in" id="doc-${i}-status" data-path="documents.${i}.status" aria-label="Status" ${fs}>${st.map(o => `<option value="${o[0]}" ${d.status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></td><td><input class="in" type="date" id="doc-${i}-date" data-path="documents.${i}.date" value="${esc(d.date)}" aria-label="Date" ${fs}></td></tr>`).join('');
  const line = e.independentReviewerReportsTo, cro = pname(e.croPersonId);
  return `${opening('Phase 0 · mobilise', 'Set up the assessment', 'Engagement, people, the independent reviewer, the calibration set, documents and interviews.')}
  ${whyNote(why)}
  <div class="stack">
  <section class="card"><h2 class="sh">1 · Engagement</h2><div class="fgrid">${fld('Insurer', 'engagement.insurer', e.insurer)}${fld('Reference', 'engagement.reference', e.reference)}${fld('Counsel firm', 'engagement.counselFirm', e.counselFirm)}${fld('Start date', 'engagement.startDate', e.startDate, { type: 'date' })}</div>
    <div style="margin-top:14px">${fld(T('privilege', 'Privilege marking') + ' · as counsel directs, printed on every output', 'engagement.privilegeMarking', e.privilegeMarking, { raw: true })}</div>
    <div class="fgrid" style="margin-top:14px">${fld('Brief confirmed by (GC)', 'engagement.briefConfirmed.by', e.briefConfirmed.by, { select: peopleOpts('gc') })}${fld('Confirmed on', 'engagement.briefConfirmed.on', e.briefConfirmed.on, { type: 'date' })}${fld('Brief reference', 'engagement.briefConfirmed.ref', e.briefConfirmed.ref)}${fld('Document request issued', 'engagement.documentsRequestedOn', e.documentsRequestedOn, { type: 'date' })}</div></section>
  <section class="card"><div class="row between"><h2 class="sh" style="margin:0">2 · People</h2>${savesHere() ? (SRV.user && SRV.user.isAdmin ? '<a class="btn sm" href="/admin/">Manage in Admin</a>' : '') : `<button class="btn sm" data-act="addPerson" ${fs}>Add person</button>`}</div><p class="small soft" style="margin:8px 0 12px">${savesHere() ? 'Everyone with a role in this assessment. An administrator adds people and gives roles in Admin. What each person can do follows from their roles, and separation of duties is enforced by person, on the server as well as here.' : 'Practice: the person chosen in the header sets what the app permits. Separation of duties is enforced by person, not by role.'}</p><div class="stack" style="gap:10px">${people || '<p class="small soft">No one recorded yet.</p>'}</div></section>
  <section class="card"><h2 class="sh">3 · ${T('ir', 'Independent reviewer')}</h2><p class="small soft">Reviews the assessment on behalf of the CRO. The app shows the role, never the firm.</p><div class="fgrid">${fld('Person', 'engagement.irPersonId', e.irPersonId, { select: peopleOpts('ir') })}${fld('Organisation filling the role', 'engagement.irOrganisation', e.irOrganisation)}${fld('Reporting line', 'engagement.independentReviewerReportsTo', line, { select: [['counsel', 'Through counsel'], ['cro', 'Directly to the CRO']] })}${fld('CRO', 'engagement.croPersonId', e.croPersonId, { select: peopleOpts('cro', S.people.some(p => p.roles.includes('cro')) ? '—' : 'Add a person with the CRO role') })}</div>
    <p class="small" style="margin-top:10px">Review pack addressed to <strong>${line === 'cro' ? esc(cro || 'the CRO') : esc(e.counselFirm || 'counsel')}</strong>. R7 confirmed by ${line === 'cro' ? 'the CRO' + (cro ? ' (' + esc(cro) + ')' : '') : 'the independent reviewer, through counsel'}.</p></section>
  <section class="card"><div class="row between"><h2 class="sh" style="margin:0">4 · ${T('calibration', 'Calibration set')}</h2><div class="row">${calBadge()}<button class="btn sm aub" data-act="loadCalApp" ${fs} title="Read the issued calibration set from the AI Risk Appetite app">Load from the Risk Appetite app</button><button class="btn sm" data-act="loadCal" ${fs}>Load from a file</button></div></div>
    ${c ? `<p class="small" style="margin-top:10px">${esc(calLabel())}${c.agreedBy ? ' · agreed by ' + esc(c.agreedBy) : ''}${c.approvedBy ? ' · approved by ' + esc(c.approvedBy) : ''}</p><p class="small soft">Default values: ${c.fellBack.length ? esc(c.fellBack.join('; ')) : 'none'}.</p>` : '<p class="small soft" style="margin-top:10px">JSON from the AI Risk Appetite app. Without one, the framework defaults apply and every output is marked uncalibrated. Loading a new version recomputes expected rungs, flags, priorities and due dates, and writes a difference report.</p>'}
    ${S.diffReports.length ? `<p class="small">${S.diffReports.length} difference ${S.diffReports.length === 1 ? 'report' : 'reports'} · <button class="lnk" data-act="outTab" data-t="DR">open</button></p>` : ''}</section>
  <section class="card"><div class="row between"><h2 class="sh" style="margin:0">5 · Documents D1 to D10</h2><button class="btn sm" data-act="addDoc" ${fs}>Add document</button></div><p class="small soft" style="margin:8px 0 12px">Each received document gets a short ID used in source references, for example <span class="mono">D5-ARR02 p.14</span>.</p>
    ${b === 'phone' ? `<div class="stack" style="gap:10px">${docs}</div>` : `<div class="tw"><table class="lg"><thead><tr><th>ID</th><th style="width:96px">Ref</th><th>Document</th><th style="width:150px">Status</th><th style="width:160px">Date</th></tr></thead><tbody>${docs}</tbody></table></div>`}</section>
  <section class="card"><div class="row between"><h2 class="sh" style="margin:0">6 · Interviews</h2><button class="btn sm" data-act="addIv" ${fs}>Add interview</button></div><div class="stack" style="gap:8px;margin-top:12px">${S.interviews.map((v, i) => `<div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${fld(v.id, `interviews.${i}.who`, v.who)}${fld('Date held', `interviews.${i}.date`, v.date, { type: 'date' })}${fld('Notes reference', `interviews.${i}.notesRef`, v.notesRef)}</div>`).join('')}</div></section>
  </div>${gateCard(0)}${stepbar(gate(gates()[0].ok, gates()[0].ok ? 'Phase 0 met' : 'Phase 0 open'))}`;
}

/* ---------- S2 overview ---------- */
function screenOverview() {
  const G = gates(), oq = S.questions.filter(q => q.status !== 'answered').length;
  const counts = [['Arrangements', S.arrangements.length], ['Register entries', S.entries.length], ['Open questions to counsel', oq], ['Findings set', S.arrangements.filter(a => finding(a).type).length + ' of ' + S.arrangements.length]];
  return `${opening('Overview', 'Eight phases, each with a gate', 'Work can run ahead of a gate. Any output produced before its gate is met is marked draft.')}
  <div class="calstrip"><div class="row">${counts.map(c => `<span><span class="mono" style="font-size:15px;font-weight:600">${esc(c[1])}</span> <span class="small soft">${c[0]}</span></span>`).join('<span class="vrule"></span>')}</div><div class="row">${calBadge()}</div></div>
  <div class="dgrid">${C.phases.map(p => `<button class="dcard" data-act="go" data-to="${p.screen}"><div class="row between"><span class="dnum">${p.n}</span>${badge(G[p.n].ok ? 'gate met' : 'open', G[p.n].ok ? 'b-green' : 'b-grey')}</div><div class="dname">${esc(p.name)}</div><div class="stack" style="gap:4px;flex:1">${G[p.n].items.map(i => gate(i[1], i[0])).join('')}</div><div class="mini">${esc(p.screenName)} →</div></button>`).join('')}</div>${stepbar()}`;
}

/* ---------- S3 set ---------- */
function screenSet() {
  const cv = coverage(), c = cal(), p1 = P('P1'), fns = p1 ? Object.keys(p1) : [], why = deny('set'), fs = why ? 'disabled' : '';
  const spread = S.entries.some(e => rk(AT, tierShown(e)) >= 2) && S.entries.some(e => tierShown(e) && rk(AT, tierShown(e)) <= 1);
  const ceilFor = a => p1 && a.function && p1[a.function] ? Object.entries(p1[a.function]).map(([k, v]) => `${k} ${v ? v.tier : '—'}`).join(' · ') : '';
  const card = (a, i) => `<div class="card" style="padding:16px"><div class="row between"><span class="mono" style="font-weight:600">${esc(a.id)}</span>${S.entries.some(x => x.arrangementId === a.id && blindFor(x)) ? badge('hidden', 'b-grey') : badge(finding(a).type || 'no finding', findingCls(finding(a).type))}</div>
    <div class="fgrid" style="margin-top:10px">${fld('Name', `arrangements.${i}.name`, a.name)}${fld('Parties', `arrangements.${i}.parties`, a.parties)}${fld('Next contracting date', `arrangements.${i}.nextContracting`, a.nextContracting, { type: 'date' })}
      ${c && fns.length ? fld('Function (for the ceiling; entries default to it)', `arrangements.${i}.function`, a.function, { select: [['', '—'], ...fns.map(f => [f, f])] }) : ''}</div>
    <div class="row" style="margin-top:10px;gap:4px 16px"><span class="mini">${T('boundary', 'BOUNDARIES')}</span>${['B1', 'B2', 'B3'].map(x => `<label class="cb small"><input type="checkbox" id="arr-${i}-b-${x}" data-arrchk="arrangements.${i}.boundaries" value="${x}" ${(a.boundaries || []).includes(x) ? 'checked' : ''} ${fs}>${x}</label>`).join('')}</div>
    <div class="row" style="margin-top:6px;gap:4px 16px;align-items:flex-start"><span class="mini">CRITERIA</span>${C.criteria.map((t, k) => { const dis = (k === 5 && !c) || why; return `<label class="cb small" ${k === 5 && !c ? 'title="Needs a calibration set"' : ''}><input type="checkbox" id="arr-${i}-c-${k + 1}" data-arrchk="arrangements.${i}.criteria" value="${k + 1}" ${(a.criteria || []).includes(String(k + 1)) ? 'checked' : ''} ${dis ? 'disabled' : ''}>${k + 1}. ${esc(t)}</label>`; }).join('')}</div>
    ${c && ceilFor(a) ? `<div class="mini" style="margin-top:6px">Ceiling for ${esc(a.function)}: ${esc(ceilFor(a))}</div>` : ''}
    <div style="margin-top:10px">${fld('Reason selected', `arrangements.${i}.reason`, a.reason, { area: true })}</div><div class="row" style="justify-content:flex-end"><button class="btn sm ghost" data-act="rmArr" data-i="${i}" ${fs}>Remove</button></div></div>`;
  const ag = (who, on, act, label) => who ? `<div class="panel2" style="padding:12px 14px">${badge('agreed', 'b-green')} <strong>${esc(pname(who) || who)}</strong> <span class="mini">${esc(on)}</span></div>` : `<div class="panel2" style="padding:12px 14px"><button class="btn sm" data-act="${act}" ${deny(act) ? 'disabled title="' + esc(deny(act)) + '"' : ''}>${label}</button>${deny(act) ? whyNote(deny(act)) : ''}</div>`;
  return `${opening('Phase 1 · confirm the set', 'The representative set', 'Arrangements agreed with the GC, chosen against six criteria. The default is four.')}
  <div class="calstrip"><div class="row"><span class="sh" style="margin:0">Coverage</span>${['B1', 'B2', 'B3'].map(x => badge(x + (cv[x] ? ' ✓' : ' missing'), cv[x] ? 'b-green' : 'b-ochre')).join('')}${badge('authority spread' + (spread ? ' ✓' : ' not yet'), spread ? 'b-green' : 'b-grey')}</div><button class="btn sm" data-act="addArr" ${fs}>Add arrangement</button></div>
  ${whyNote(why)}
  <div class="stack" style="gap:12px">${S.arrangements.map(card).join('') || `<p class="soft">No arrangements yet. ${T('set', 'The representative set')} is chosen in this order: ${C.criteria.slice(0, 5).map((t, k) => (k + 1) + '. ' + esc(t)).join(' · ')}.</p>`}</div>
  <section class="card" style="margin-top:18px"><h2 class="sh">Agree the set · R1</h2><p class="small soft">The GC and counsel each record their own agreement.</p><div class="grid2">${ag(S.setAgreed.gcBy, S.setAgreed.gcOn, 'agreeGC', 'Record GC agreement')}${ag(S.setAgreed.counselBy, S.setAgreed.counselOn, 'agreeCounsel', 'Record counsel agreement')}</div>
    <p class="small soft" style="margin-top:8px">A boundary type not represented must be recorded in the exceptions log (Review) with its code.</p></section>
  ${gateCard(1)}${stepbar(gate(gates()[1].ok, gates()[1].ok ? 'Phase 1 met' : 'Phase 1 open'))}`;
}

/* ---------- S4 register ---------- */
const eIdx = e => S.entries.indexOf(e);
function entryRowVals(e) { const bl = blindFor(e), ex = expected(e), ob = obResult(e), f = finding(arr(e.arrangementId)); return { bl, tier: bl ? 'hidden' : fv(e, 15), ex: bl ? 'hidden' : ex ? ex.value : '—', ob: bl ? '—' : ob.done ? ob.rung : '—', f: bl ? { type: null, label: 'hidden' } : f, fl: bl ? [] : flags(e), done: [3,4,5,6,7,8,9,10,11,12,13,14].filter(n => fieldDone(e, n)).length, nk: notKnownCount(e) }; }
function filterControls(prefix) {
  const F = UI.filt, sel = (k, opts, label) => `<label class="f" style="min-width:140px" for="${prefix}-${k}"><span>${label}</span><select class="in" id="${prefix}-${k}" data-filt="${k}">${opts.map(o => `<option value="${esc(o[0])}" ${F[k] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  return `${sel('arr', [['', 'All'], ...S.arrangements.map(a => [a.id, a.id])], 'Arrangement')}${sel('b', [['', 'All'], ['B1', 'B1'], ['B2', 'B2'], ['B3', 'B3']], 'Boundary')}${sel('f', [['', 'All'], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['none', 'No finding']], 'Finding')}${sel('flag', [['', 'All'], ['aboveCeiling', 'Above ceiling'], ['location', 'Location'], ['belowConfidence', 'Below confidence'], ['notKnownOverLimit', 'Not known over limit'], ['f4TooLong', 'F4 standing too long']], 'Flag')}<label class="cb"><input type="checkbox" id="${prefix}-nk" data-filt="nk" ${F.nk ? 'checked' : ''}> Has not known</label>`;
}
function screenRegister() {
  if (UI.entryId && ent(UI.entryId)) return entryEditor(ent(UI.entryId));
  const F = UI.filt, b = bp(), fwhy = deny('facts');
  const list = S.entries.filter(e => { const v = entryRowVals(e); return (!F.arr || e.arrangementId === F.arr) && (!F.b || fv(e, 3) === F.b) && (!F.f || (v.f.type || 'none') === F.f) && (!F.flag || v.fl.some(x => x.id === F.flag)) && (!F.nk || v.nk > 0); });
  const nf = Object.entries(F).filter(([, v]) => v).length;
  const filters = b === 'phone' ? `<div class="row" style="margin-bottom:14px"><button class="btn sm" id="openFilters" data-act="sheet" data-s="filters">Filters${nf ? ' · ' + nf : ''}</button></div>` : `<div class="row" style="align-items:flex-end;margin-bottom:14px">${filterControls('filt')}</div>`;
  const eid = e => esc(e.id);
  let rows;
  const vis = (e, n) => blindFor(e) && ![11, 12, 13].includes(n) ? '' : fv(e, n);
  if (b === 'phone') rows = list.map(e => { const v = entryRowVals(e); return `<button class="dcard" data-act="openEntry" data-id="${eid(e)}"><div class="row between"><span class="mono" style="font-weight:600">${eid(e)}</span><span class="mono soft">${esc(e.arrangementId)}</span></div><div class="small">${esc(vis(e, 7) || 'System not recorded')}</div><div class="row" style="gap:6px">${[vis(e, 3), v.tier, vis(e, 16), v.ex !== '—' ? (cal() ? 'exp ' : 'ind ') + v.ex : '', v.ob !== '—' ? 'obt ' + v.ob : ''].filter(Boolean).map(x => badge(x, 'b-grey')).join('')}${badge(v.f.type || v.f.label || 'no finding', findingCls(v.f.type))}${v.fl.map(x => badge(x.label, x.cls)).join('')}</div><div class="mini">${v.done}/12 facts · ${v.nk} not known</div></button>`; }).join('');
  else if (b === 'tab') rows = list.map(e => { const v = entryRowVals(e), open = !!UI.expanded[e.id]; return `<tr><td class="code"><button class="lnk mono" data-act="openEntry" data-id="${eid(e)}">${eid(e)}</button></td><td class="code">${esc(e.arrangementId)}</td><td class="code">${esc(v.tier)}</td><td class="code">${esc(v.ex)}</td><td class="code">${esc(v.ob)}</td><td>${badge(v.f.type || v.f.label || '—', findingCls(v.f.type))}</td><td><button class="iconbtn" id="exp-${sid(e.id)}" data-act="expand" data-id="${eid(e)}" aria-expanded="${open}" aria-label="More about ${eid(e)}">${open ? '−' : '+'}</button></td></tr>${open ? `<tr><td colspan="7" style="background:var(--parchment)"><div class="row" style="gap:6px 18px"><span class="small"><span class="mini">BOUNDARY</span> ${esc(vis(e, 3) || '—')}</span><span class="small"><span class="mini">ACTS</span> ${esc(optL(vis(e, 4)) || '—')}</span><span class="small"><span class="mini">SYSTEM</span> ${esc(vis(e, 7) || '—')}</span><span class="small"><span class="mini">CONSEQUENCE</span> ${esc(vis(e, 16) || '—')}</span><span class="small"><span class="mini">FACTS</span> ${v.done}/12${v.nk ? ' · ' + v.nk + ' not known' : ''}</span>${v.fl.map(x => badge(x.label, x.cls)).join('')}</div></td></tr>` : ''}`; }).join('');
  else rows = list.map(e => { const v = entryRowVals(e); return `<tr><td class="code"><button class="lnk mono" data-act="openEntry" data-id="${eid(e)}">${eid(e)}</button></td><td class="code">${esc(e.arrangementId)}</td><td class="code">${esc(vis(e, 3))}</td><td class="small">${esc(optL(vis(e, 4)))}</td><td class="small">${esc(vis(e, 7))}</td><td class="code">${esc(v.tier)}</td><td class="code">${esc(vis(e, 16))}</td><td class="code">${esc(v.ex)}</td><td class="code">${esc(v.ob)}</td><td>${badge(v.f.type || v.f.label || '—', findingCls(v.f.type))}</td><td>${v.fl.map(x => badge(x.label, x.cls)).join(' ')}</td><td class="mini">${v.done}/12${v.nk ? ' · ' + v.nk + ' NK' : ''}</td></tr>`; }).join('');
  const thead = b === 'tab' ? `<tr><th>REG</th><th>ARR</th><th>${T('tier', 'Tier')}</th><th>${cal() ? T('expected', 'Exp') : T('indicative', 'Ind')}</th><th>${T('obtainable', 'Obt')}</th><th>Finding</th><th></th></tr>`
    : `<tr><th>REG</th><th>ARR</th><th>${T('boundary', 'Bdy')}</th><th>Acts</th><th>System</th><th>${T('tier', 'Tier')}</th><th>Cons</th><th>${cal() ? T('expected', 'Exp') : T('indicative', 'Ind')}</th><th>${T('obtainable', 'Obt')}</th><th>Finding</th><th>Flags</th><th>Facts</th></tr>`;
  return `${opening('Phase 2 · map the AI', 'AI use register', 'One entry for each place AI acts. Every value sourced, or recorded as not known.')}
  <div class="row" style="margin-bottom:12px">${S.arrangements.length ? `<select class="in" id="newEntryArr" style="width:auto" aria-label="Arrangement for new entry">${S.arrangements.map(a => `<option value="${esc(a.id)}">${esc(a.id)} ${esc(a.name)}</option>`).join('')}</select><button class="btn sm" data-act="addEntry" ${fwhy ? 'disabled' : ''}>Add entry</button>` : '<span class="small soft">Add arrangements in Set first.</span>'}</div>${whyNote(fwhy)}
  ${filters}
  ${list.length ? (b === 'phone' ? `<div class="stack" style="gap:10px">${rows}</div>` : `<div class="tw"><table class="lg"><thead style="position:sticky;top:0">${thead}</thead><tbody>${rows}</tbody></table></div>`) : '<p class="soft">No entries match.</p>'}
  ${gateCard(2)}${stepbar(gate(gates()[2].ok, gates()[2].ok ? 'Phase 2 met' : 'Phase 2 open'))}`;
}
function srcList() { return `<datalist id="srcs">${S.documents.filter(d => d.status === 'received').map(d => `<option value="${esc(d.id)} p.">`).join('')}${S.interviews.filter(v => v.date).map(v => `<option value="${esc(v.id)} ${esc(v.date)}">`).join('')}</datalist>`; }
function fieldRow(e, n) {
  const d = FLD(n), f = e.fields[n] || {}, why = deny('facts', e), ed = !why, base = `e-${sid(e.id)}-f${n}`, nk = !!f.notKnown, dis = !ed || nk ? 'disabled' : '';
  let ctl;
  if (d.kind.startsWith('select:')) ctl = `<select class="in" id="${base}-val" data-fv="${n}" ${dis}><option value="">—</option>${d.kind.slice(7).split('|').map(o => `<option value="${o}" ${f.value === o ? 'selected' : ''}>${esc(optL(o))}</option>`).join('')}</select>`;
  else if (d.kind === 'rung') ctl = `<div class="row" style="flex-wrap:nowrap"><select class="in" id="${base}-val" data-fv="${n}" style="width:auto" ${dis}><option value="">—</option><option value="none" ${f.value === 'none' ? 'selected' : ''}>none</option>${EV.slice(1).map(r => `<option value="${r}" ${f.value === r ? 'selected' : ''}>${r} ${esc(rungName(r))}</option>`).join('')}</select><input class="in" id="${base}-det" data-fd="${n}" value="${esc(f.detail || '')}" placeholder="Description" aria-label="Field ${n} description" ${dis}></div>`;
  else if (d.kind === 'area') ctl = `<textarea class="in" id="${base}-val" data-fv="${n}" ${dis}>${esc(f.value || '')}</textarea>`;
  else ctl = `<input class="in" id="${base}-val" data-fv="${n}" value="${esc(f.value || '')}" ${dis}>`;
  const hist = UI.hist === e.id + '.' + n ? S.history.filter(h => h.target === e.id && h.action === 'field ' + n).slice(-5).reverse() : null;
  const extra = n === 20 ? `<input class="in" id="${base}-det" data-fd="20" value="${esc(f.detail || '')}" placeholder="Reason" aria-label="Field 20 reason" ${dis}>` : '';
  const side = bp() === 'desk';
  return `<div class="panel2" style="padding:12px 14px;background:${fieldDone(e, n) ? 'var(--card)' : 'var(--parchment-2)'}">
    <div class="row between"><label for="${base}-val" style="font-weight:600;font-size:14px"><span class="mono soft">${n}</span> ${esc(d.name)}</label><span class="mini">${esc(d.format)}</span></div>
    <div style="display:grid;grid-template-columns:${side ? 'minmax(0,1fr) 220px' : '1fr'};gap:10px;margin-top:8px"><div class="stack" style="gap:6px">${ctl}${extra}</div>
      <div class="stack" style="gap:6px"><input class="in mono" list="srcs" id="${base}-src" data-fs="${n}" value="${esc(f.source || '')}" placeholder="Source: D5 p.14" aria-label="Field ${n} source reference" ${dis}>
        <div class="row" style="gap:10px"><label class="cb small"><input type="checkbox" id="${base}-nk" data-fnk="${n}" ${nk ? 'checked' : ''} ${ed ? '' : 'disabled'}>${T('notKnown', 'Not known')}</label><button class="lnk mono" id="${base}-hist" data-act="hist" data-k="${esc(e.id)}.${n}" aria-expanded="${!!hist}">history</button>${ok('ask') ? `<button class="lnk mono" id="${base}-ask" data-act="askFrom" data-id="${esc(e.id)}" data-n="${n}">ask counsel</button>` : ''}</div></div></div>
    ${hist ? `<div class="mini" style="margin-top:6px">${hist.length ? hist.map(h => `${esc(fmtAt(h.at))} · ${esc(h.by)} · ${esc(h.from == null ? '—' : h.from)} → ${esc(h.to == null ? '—' : h.to)}`).join('<br>') : 'No changes recorded.'}</div>` : ''}
    ${f.by ? `<div class="mini" style="margin-top:4px">${esc(pname(f.by))} · ${esc(f.on)}</div>` : ''}</div>`;
}
function entryEditor(e) {
  const a = arr(e.arrangementId), bl = blindFor(e), tabs = bl ? [['facts', 'Facts · 1–14']] : [['facts', 'Facts · 1–14'], ['classify', 'Classify · 15–17'], ['evidence', 'Evidence · 18–22'], ['counsel', 'Counsel · 23–25'], ['finding', 'Finding · 26']], t = bl ? 'facts' : UI.tab, i = eIdx(e), why = deny('facts', e), ed = !why;
  const p1 = P('P1'), p8 = P('P8'), ex = expected(e), ob = obResult(e), fl = bl ? [] : flags(e), fd = finding(a);
  let body = '';
  if (t === 'facts' && bl) body = `<div class="stack" style="gap:10px"><p class="small soft">During blind re-derivation only fields 11 to 13 are shown.</p>${[11, 12, 13].map(n => fieldRow(e, n)).join('')}</div>`;
  else if (t === 'facts') body = `<div class="stack" style="gap:10px">${[3,4,5].map(n => fieldRow(e, n)).join('')}
    ${cal() && p1 ? `<div class="panel2" style="padding:12px 14px">${fld('Function for the ' + T('ceiling', 'ceiling') + ' · defaults to the arrangement\u2019s' + (a && a.function ? ' (' + esc(a.function) + ')' : ''), `entries.${i}.functionName`, e.functionName, { select: [['', 'Arrangement default'], ...Object.keys(p1).map(k => [k, k])], raw: true })}</div>` : ''}
    ${[6,7,8,9,10].map(n => fieldRow(e, n)).join('')}
    <div class="panel2" style="padding:12px 14px"><div class="mini" style="margin-bottom:6px">LOCATION FOR THE P8 MARKING</div><div class="fgrid">${fld('Provider established in', `entries.${i}.locEstablished`, e.locEstablished, { ph: p8 ? Object.values(p8).map(v => v.name).filter(Boolean).join(', ') : 'Country' })}${fld('AI runs in', `entries.${i}.locRuns`, e.locRuns, { ph: p8 ? Object.values(p8).map(v => v.name).filter(Boolean).join(', ') : 'Country' })}</div></div>
    ${[11,12,13,14].map(n => fieldRow(e, n)).join('')}
    <div class="card" style="padding:14px 16px"><label class="cb"><input type="checkbox" id="e-${sid(e.id)}-nd" data-path="entries.${i}.notDeterminable.on" ${e.notDeterminable.on ? 'checked' : ''} ${ed ? '' : 'disabled'}> AI use ${T('F4', 'not determinable on documents')} (stop rule)</label>
      ${e.notDeterminable.on ? `<div class="fgrid" style="margin-top:8px">${fld('The specific question that would resolve it', `entries.${i}.notDeterminable.question`, e.notDeterminable.question)}${fld('Who could answer it', `entries.${i}.notDeterminable.who`, e.notDeterminable.who)}${fld('Recorded as F4 on', `entries.${i}.notDeterminable.since`, e.notDeterminable.since, { type: 'date' })}</div>${f4Period(e) ? `<p class="mini" style="margin-top:6px">P6 allows an F4 at this band to stand until: ${esc(f4Period(e))}</p>` : ''}` : ''}</div></div>`;
  if (t === 'classify') body = `<div class="stack" style="gap:10px">
    <div class="card"><div class="row between"><strong><span class="mono soft">15</span> Authority tier</strong>${fv(e, 15) ? badge(fv(e, 15) + ' ' + tierName(fv(e, 15)), 'b-aub') : badge('not set', 'b-grey')}</div><p class="small soft" style="margin:6px 0 0">Proposed from the answers: ${esc(proposeTier(e) || '—')}${e.tierOverrideReason ? ' · override reason: ' + esc(e.tierOverrideReason) : ''}. Classified by ${esc(pname(e.classifiedBy) || '—')}.</p></div>
    <div class="card"><div class="row between"><strong><span class="mono soft">16</span> Failure consequence</strong>${fv(e, 16) ? badge(fv(e, 16) + ' ' + consName(fv(e, 16)), 'b-aub') : badge('not set', 'b-grey')}</div><p class="small soft" style="margin:6px 0 0">${e.consequenceConfirmedBy ? 'Confirmed by ' + esc(pname(e.consequenceConfirmedBy)) + ' on ' + esc(e.consequenceConfirmedOn) : 'Not yet confirmed by the arrangement owner.'}</p></div>
    <div class="card"><div class="row between"><strong><span class="mono soft">17</span> ${T(cal() ? 'expected' : 'indicative', esc(rungLabel()))}</strong>${ex ? badge(ex.value + ' ' + rungName(ex.value), 'b-aub') : badge('needs 15 and 16', 'b-grey')}</div>${ex ? `<p class="small soft" style="margin:6px 0 0">${esc(ex.adjustment)}</p>` : ''}</div>
    <div class="row">${fl.map(x => badge(x.label, x.cls)).join('') || '<span class="small soft">' + (cal() ? 'No calibration flags.' : 'Flags need a calibration set.') + '</span>'}</div>
    <button class="btn primary sm" data-act="classifyEntry" data-id="${esc(e.id)}" style="align-self:flex-start">Classify and test this entry →</button></div>`;
  if (t === 'evidence') body = `<div class="stack" style="gap:10px">${[18,19,20].map(n => fieldRow(e, n)).join('')}
    <div class="card"><div class="row between"><strong><span class="mono soft">21</span> ${T('obtainable', 'Obtainable rung')}</strong>${ob.done ? badge(ob.rung + ' ' + rungName(ob.rung), 'b-green') : badge(ob.current ? 'testing ' + ob.current : 'not tested', 'b-grey')}</div>${ob.none ? `<p class="small" style="margin:6px 0 0">${esc(e0Msg())}.</p>` : ''}${needsRetest(e) ? `<p class="small" style="color:var(--ochre);margin:6px 0 0">Test started at ${esc(e.obtainability.start)}; the ${rungWord()} is now ${esc(ex.value)}. Marked for re-test.</p>` : ''}</div>
    <div class="card"><div class="row between"><strong><span class="mono soft">22</span> ${T('confidence', 'Confidence')}</strong>${ob.none ? badge('n/a', 'b-grey') : confidence(e) ? badge(confidence(e), 'b-grey') : badge('not set', 'b-grey')}</div></div>
    <button class="btn sm" data-act="classifyEntry" data-id="${esc(e.id)}" data-step="4" style="align-self:flex-start">Open the obtainability test →</button></div>`;
  if (t === 'counsel') body = `<p class="small soft">Fields 23 to 25 are never completed by Triodian. They are filled only from the newest answered ${T('qc', 'question to counsel')} for the entry, citing its reference.</p><div class="stack" style="gap:10px">${[23,24,25].map(n => { const f = e.fields[n]; return `<div class="card"><div class="row between"><strong><span class="mono soft">${n}</span> ${esc(FLD(n).name)}</strong>${f && f.value ? badge('from ' + f.source, 'b-green') : badge('awaiting counsel', 'b-ochre')}</div>${f && f.value ? `<p style="margin:8px 0 0">${esc(f.value)}${f.detail ? ' · ' + esc(f.detail) : ''}</p><p class="mini">${f.transcribedBy ? 'transcribed by ' + esc(pname(f.transcribedBy)) : 'entered by counsel'} · ${esc(f.on)} · locked</p>` : `<p class="small soft" style="margin:6px 0 0">${esc(FLD(n).format)}</p>`}</div>`; }).join('')}
    ${ok('ask') ? `<button class="btn sm" data-act="askFrom" data-id="${esc(e.id)}" data-n="25" style="align-self:flex-start">Ask counsel about this entry</button>` : ''}</div>`;
  if (t === 'finding') body = `<div class="card"><div class="row between"><strong><span class="mono soft">26</span> Finding for ${esc(a.id)}</strong>${badge(fd.type ? fd.type + ' ' + findingName(fd.type) : (fd.label || 'none'), findingCls(fd.type))}</div><p class="small soft">One finding per arrangement, set after counsel has set the required rung.</p>${a.missing ? '<p class="err">This entry points to an arrangement that does not exist. See Broken references on the Review screen.</p>' : fld('Named gap owner', `arrangements.${arrIdx(a)}.findingOwner`, a.findingOwner || '')}<button class="btn sm" style="margin-top:10px" data-act="go" data-to="findings">Open the worksheet →</button></div>`;
  return `${opening(`Register · ${esc(e.arrangementId)}${a ? ' · ' + esc(a.name) : ''}`, esc(e.id), esc(fv(e, 7) || 'System not yet recorded'))}
  <div class="row" style="margin:-14px 0 18px"><button class="btn sm" data-act="closeEntry">← All entries</button>${fl.map(x => badge(x.label, x.cls)).join('')}<span class="mini">${notKnownCount(e)} not known</span>${ed ? `<button class="btn sm ghost" data-act="rmEntry" data-id="${esc(e.id)}">Delete entry</button>` : ''}</div>
  ${bl ? '<p class="small" style="color:var(--aubergine)">Blind re-derivation: classification, evidence, counsel and finding are hidden for this entry until you record your R3 tier in Classify.</p>' : ''}
  ${bp() === 'phone' ? `<label class="f" for="etab"><span>Section</span><select class="in" id="etab" data-act="tab">${tabs.map(x => `<option value="${x[0]}" ${t === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></label><div style="height:14px"></div>` : `<div class="tabs" role="tablist">${tabs.map(x => `<button role="tab" id="etab-${x[0]}" aria-selected="${t === x[0]}" data-act="tab" data-t="${x[0]}">${x[1]}</button>`).join('')}</div>`}
  ${whyNote(why)}
  ${srcList()}${body}`;
}

/* ---------- S5 classify and test ---------- */
const AT_OPTS = [[['person', 'A person acts on the output'], ['without', 'The output takes effect without one']], [['yes', 'Yes'], ['no', 'No']], [['yes', 'Yes'], ['no', 'No']], [['yes', 'Yes'], ['no', 'No']]];
function screenClassify() {
  const e = ent(UI.entryId) || S.entries[0];
  if (!e) return `${opening('Phase 3 · classify and test', 'Classify and test', '')}<p class="soft">No register entries yet.</p>${stepbar()}`;
  UI.entryId = e.id; const i = eIdx(e), b = bp(), m = me(), cwhy = deny('classify', e), canC = !cwhy, bl = blindFor(e), base = 'c-' + sid(e.id);
  const s = bl ? 5 : UI.step;
  const steps = ['Authority', 'Consequence', rungLabel(), 'Obtainability', 'Blind re-derivation'];
  const facts = `<div class="card"><h2 class="sh">Facts · fields 11 to 13</h2>${[11, 12, 13].map(n => `<div style="margin-bottom:10px"><div class="mini">${n} ${esc(FLD(n).name).toUpperCase()}</div><div class="small">${e.fields[n] && e.fields[n].notKnown ? '<em>not known</em>' : esc(optL(fv(e, n))) || '—'}</div><div class="mini">${esc((e.fields[n] || {}).source || '')}</div></div>`).join('')}
    ${bl ? '' : `<div class="mini">5 FUNCTION · 4 WHERE</div><div class="small">${esc(fv(e, 5) || '—')} · ${esc(optL(fv(e, 4)) || '—')}</div>`}</div>`;
  const ex = expected(e), ob = obResult(e), fl = flags(e);
  const result = bl ? `<div class="card"><h2 class="sh">Result so far</h2><p class="small soft">Hidden during ${T('blind', 'blind re-derivation')}.</p></div>` : `<div class="card"><h2 class="sh">Result so far</h2><div class="stack" style="gap:8px">
    ${[['Tier', fv(e, 15) ? fv(e, 15) + ' ' + tierName(fv(e, 15)) : '—'], ['Consequence', fv(e, 16) ? fv(e, 16) + ' ' + consName(fv(e, 16)) : '—'], [rungLabel(), ex ? ex.value : '—'], ['Obtainable', ob.done ? ob.rung : ob.current ? 'testing ' + ob.current : '—'], ['Confidence', ob.none ? 'n/a' : confidence(e) || '—'], ['Classified by', pname(e.classifiedBy) || '—'], ['Peer reviewer', pname(e.peerReview.personId) || '—']].map(r => `<div class="row between"><span class="small soft">${esc(r[0])}</span><span class="mono">${esc(r[1])}</span></div>`).join('')}
    <div class="row">${fl.map(x => badge(x.label, x.cls)).join('')}</div></div></div>`;
  let step = '';
  if (s === 1) {
    const p = proposeTier(e), ok11 = fieldDone(e, 11), dis = ok11 && canC ? '' : 'disabled';
    step = `<h2 class="sh">Question 5 · ${T('tier', 'authority')}</h2><div class="stack" style="gap:10px">${C.authorityTests.map((q, k) => { const a = e.authorityTests[k], v = a.answer === null ? '' : k === 0 ? (a.answer ? 'without' : 'person') : (a.answer ? 'yes' : 'no'); return `<div class="panel2" style="padding:12px 14px"><label class="small" style="font-weight:600" for="${base}-at${k}">${k < 3 ? 'Test ' + (k + 1) : 'Field 13'} · ${esc(q)}</label><div class="row" style="margin-top:8px;flex-wrap:nowrap"><select class="in" style="width:auto;max-width:60%" id="${base}-at${k}" data-at="${k}" ${canC ? '' : 'disabled'}><option value="">—</option>${AT_OPTS[k].map(o => `<option value="${o[0]}" ${v === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><input class="in mono" list="srcs" id="${base}-ats${k}" data-ats="${k}" value="${esc(a.source)}" placeholder="Source" aria-label="Source for test ${k + 1}" ${canC ? '' : 'disabled'}></div></div>`; }).join('')}
      <div class="card"><div class="row between"><span>Proposed tier</span>${p ? badge(p + ' ' + tierName(p), 'b-aub') : badge('needs field 12 or an answer', 'b-grey')}</div><p class="mini" style="margin:6px 0 0">The highest tier any answer supports (section 7.2). Where a system fits two tiers, the higher one is recorded.</p></div>
      ${!ok11 ? `<p class="err" role="alert">Field 15 cannot be set until field 11 is saved with a source. ${T('rule11', 'Why')}</p>` : ''}${whyNote(cwhy)}
      <div class="fgrid"><label class="f" for="tierSel"><span>Record tier · field 15</span><select class="in" id="tierSel" ${dis}><option value="">Choose a tier</option>${AT.map(t => `<option ${fv(e, 15) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${fld('Override reason (if not the proposed tier)', `entries.${i}.tierOverrideReason`, e.tierOverrideReason)}</div>
      ${UI.err.tier ? `<p class="err" role="alert">${esc(UI.err.tier)}</p>` : ''}<button class="btn primary sm" id="${base}-settier" data-act="setTier" style="align-self:flex-start" ${dis}>Record tier</button></div>`;
  }
  if (s === 2) { const p2 = P('P2'), ins = c => p2 && typeof p2 === 'object' ? Object.entries(p2).filter(([k]) => k.startsWith(c)).map(([k, v]) => { const lbl = k.replace(/^C\d+\s*[,·:]?\s*/, ''); return `<br><span class="small">Insurer · ${esc(lbl)}: ${esc(v || '')}</span>`; }).join('') : '';
    const cwy = deny('consequence');
    step = `<h2 class="sh">Question 6 · ${T('consequence', 'failure consequence')}</h2><p class="small soft">The most serious credible outcome if the AI acted wrongly and went undetected for one reporting period, anchored to the insurer's tolerance for the critical operation in field 5.</p>
    <div class="stack" style="gap:8px">${C.consequences.map(c => `<label class="panel2 cb" style="padding:10px 14px;align-items:flex-start;${fv(e, 16) === c.code ? 'border-color:var(--aubergine);background:var(--aubergine-bg)' : ''}"><input type="radio" name="cons" id="${base}-cons-${c.code}" data-cons="${c.code}" ${fv(e, 16) === c.code ? 'checked' : ''} ${canC ? '' : 'disabled'}><span><span class="mono" style="font-weight:600">${c.code}</span> ${esc(c.name)}<br><span class="small soft">${esc(c.def)}</span>${ins(c.code)}</span></label>`).join('')}</div>
    <div style="margin-top:10px">${fld('Rationale and source · field 16', `entries.${i}.fields.16.source`, (e.fields[16] || {}).source || '', { ph: 'Two lines tied to the facts; e.g. D10 incident log' })}</div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="confirmCons" ${!cwy && fv(e, 16) ? '' : 'disabled'}>Confirm as arrangement owner</button><span class="small soft">${e.consequenceConfirmedBy ? 'Confirmed by ' + esc(pname(e.consequenceConfirmedBy)) + ', ' + esc(e.consequenceConfirmedOn) : esc(cwy || '')}</span></div>${whyNote(cwhy)}`; }
  if (s === 3) step = `<h2 class="sh">${T(cal() ? 'expected' : 'indicative', esc(rungLabel()))} · field 17</h2>${ex ? `<div class="card"><div class="dnum" style="font-size:40px">${esc(ex.value)}</div><div style="font-weight:600">${esc(rungName(ex.value))}</div><p class="small soft" style="margin-top:8px">${esc(ex.adjustment)}</p><p class="mini">Basis: ${ex.basis === 'calibration' ? 'calibration set' : 'framework base rule'}</p></div>` : '<p class="soft">Needs fields 15 and 16.</p>'}
    <div class="card" style="margin-top:12px"><div class="mini">FIELD 18 · EVIDENCE CURRENTLY RECEIVED</div><div>${esc(fv(e, 18) || '—')} ${esc((e.fields[18] || {}).detail || '')}</div></div>${fv(e, 15) === 'A1' && fv(e, 16) === 'C1' ? '<p class="small" style="margin-top:10px">Stop rule: A1 with C1. The obtainability test is limited to whether disclosure exists.</p>' : ''}`;
  if (s === 4) {
    const L = ladder(e), R = e.obtainability.rungs || {};
    let shown = []; for (const r of L) { shown.push(r); const t = R[r] || {}; if (C.tests.every(x => t[x.id] && t[x.id].pass === true)) break; if (!C.tests.some(x => t[x.id] && t[x.id].pass === false)) break; }
    if (b === 'phone' && shown.length > 1) shown = shown.slice(-1);
    const rungCard = r => { const t = R[r] || {}; const st = C.tests.every(x => t[x.id] && t[x.id].pass === true) ? 'passes all five' : C.tests.some(x => t[x.id] && t[x.id].pass === false) ? 'fails · step down' : 'testing';
      return `<div class="card" style="padding:14px 16px"><div class="row between"><span><span class="mono" style="font-weight:600;font-size:15px">${r}</span> ${esc(rungName(r))}</span>${badge(st, st === 'passes all five' ? 'b-green' : st === 'testing' ? 'b-grey' : 'b-red')}</div>
        <div class="stack" style="gap:6px;margin-top:10px">${C.tests.map(x => { const v = t[x.id] || {}; return `<div style="display:grid;grid-template-columns:${b === 'phone' ? '1fr' : '150px 110px minmax(0,1fr)'};gap:6px;align-items:center"><span class="small">${T(x.id, x.id + ' ' + x.name)}</span><select class="in" id="${base}-ob-${r}-${x.id}" data-ob="${r}|${x.id}" aria-label="${r} ${x.id}" ${canC ? '' : 'disabled'}><option value="">—</option><option value="pass" ${v.pass === true ? 'selected' : ''}>Pass</option><option value="fail" ${v.pass === false ? 'selected' : ''}>Fail</option></select><input class="in" list="srcs" id="${base}-obs-${r}-${x.id}" data-obs="${r}|${x.id}" value="${esc(v.source || '')}" placeholder="Source or reason" aria-label="${r} ${x.id} source" ${canC ? '' : 'disabled'}></div>`; }).join('')}</div></div>`; };
    const failed = L.filter(r => !shown.includes(r) && R[r] && C.tests.some(x => R[r][x.id] && R[r][x.id].pass === false));
    const pc = proposedConfidence(e);
    step = `<h2 class="sh">${T('obtest', 'Obtainability test')} · field 21</h2>${!ex ? '<p class="soft">Needs fields 15 and 16.</p>' : ''}
      ${ob.none ? `<div class="card"><p style="margin:0">${esc(e0Msg())}. The obtainable rung is recorded as E0 with no tests.</p></div>` : ''}
      ${needsRetest(e) ? `<p class="small" style="color:var(--ochre)">The test started at ${esc(e.obtainability.start)}; the ${rungWord()} is now ${esc(ex.value)}. Marked for re-test from ${esc(ex.value)}.</p>` : ''}
      ${failed.length ? `<p class="small soft">${failed.map(r => `${r} failed ${C.tests.filter(x => R[r][x.id] && R[r][x.id].pass === false).map(x => x.id).join(', ')}`).join(' · ')}</p>` : ''}
      <div class="stack" style="gap:10px">${shown.map(rungCard).join('')}</div>
      ${ob.done && !ob.none ? `<div class="card" style="margin-top:12px;border-color:var(--green)"><div class="row between"><span>Obtainable rung</span>${badge(ob.rung + ' ' + rungName(ob.rung), 'b-green')}</div></div>` : ''}
      ${ob.done && !ob.none ? `<div class="card" style="margin-top:12px"><h3 class="sh">${T('confidence', 'Confidence')} · field 22</h3><p class="small">Proposed from the T1 source at ${esc(ob.rung)}: <strong>${esc(pc)}</strong>. High if a received D7, D8 or D9 item shows the record; medium if a document describes it; low if inferred${fv(e, 3) === 'B2' ? '. At B2, low unless field 14 is sourced from a document or the T1 source cites a received D7 item' : ''}.</p>
        <div class="fgrid">${fld('Confidence recorded', `entries.${i}.confChosen`, e.confChosen, { select: [['', 'As proposed (' + pc + ')'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] })}${fld('Reason for raising it above the proposal', `entries.${i}.confRaiseReason`, e.confRaiseReason || '')}</div>
        ${confRaisedNoReason(e) ? '<p class="err" role="alert">Raising confidence above the proposal needs a reason. Until one is given, the proposal applies.</p>' : ''}
        
        <p class="mini" style="margin-top:6px">Result: ${esc(confidence(e) || '—')}</p></div>` : ''}${whyNote(cwhy)}`;
  }
  if (s === 5) {
    const pr = e.peerReview, pwhy = deny('peer', e);
    if (!pr.tier) step = `<h2 class="sh">${T('blind', 'Blind re-derivation')} · R3</h2>${pwhy ? whyNote(pwhy) : `<p class="small soft">Set a tier from fields 11 to 13 alone. The classifier's tier, reasons and proposal are hidden until you record yours.</p><label class="f" style="max-width:240px" for="peerSel"><span>Your tier</span><select class="in" id="peerSel"><option value="">Choose a tier</option>${AT.map(t => `<option>${t}</option>`).join('')}</select></label>${UI.err.peer ? `<p class="err" role="alert">${esc(UI.err.peer)}</p>` : ''}<button class="btn primary sm" style="margin-top:10px" id="${base}-setpeer" data-act="setPeer">Record blind tier</button>`}`;
    else step = `<h2 class="sh">${T('blind', 'Blind re-derivation')} · R3</h2><div class="grid2"><div class="card"><div class="mini">CLASSIFIER · ${esc(pname(e.classifiedBy) || '—')}</div><div class="dnum" style="font-size:32px">${esc(fv(e, 15) || '—')}</div><div class="small soft">${esc(e.tierOverrideReason || 'No override reason')}</div></div><div class="card"><div class="mini">PEER REVIEWER · ${esc(pname(pr.personId))}</div><div class="dnum" style="font-size:32px">${esc(pr.tier)}</div><div class="small soft">Recorded ${esc(pr.on)}</div></div></div>
      <div class="row" style="margin-top:10px">${badge(pr.differs ? 'differs' : 'agrees', pr.differs ? 'b-ochre' : 'b-green')}</div>
      ${pr.differs ? `<div style="margin-top:10px">${fld('Resolution and reason · both positions are kept', `entries.${i}.peerReview.resolution`, pr.resolution, { area: true })}</div>${String(pr.resolution || '').trim() ? '' : '<p class="err" role="alert">The phase 3 gate stays closed until the difference is resolved with a reason.</p>'}` : ''}`;
  }
  const picker = `<div class="row" style="margin-bottom:14px"><label class="f" style="${bp() === 'phone' ? 'width:100%;min-width:0' : 'flex-direction:row;align-items:center;gap:8px'}" for="pickEntry"><span>Entry</span><select class="in" id="pickEntry" style="${bp() === 'phone' ? 'width:100%;min-width:0' : 'width:auto'}" data-act="pickEntry">${S.entries.map(x => `<option value="${esc(x.id)}" ${x.id === e.id ? 'selected' : ''}>${esc(x.id)} · ${esc(x.arrangementId)} · ${esc(fv(x, 7) || 'system not recorded')}</option>`).join('')}</select></label><button class="lnk mono" data-act="openEntry" data-id="${esc(e.id)}">open in register</button></div>`;
  const stepTabs = bl ? '' : `<div class="tabs" role="tablist">${steps.map((t, k) => `<button role="tab" id="cstep-${k + 1}" aria-selected="${s === k + 1}" data-act="step" data-s="${k + 1}">${k + 1} · ${esc(t)}</button>`).join('')}</div>`;
  const stepNav = bl ? '' : `<div class="row between" style="margin-top:14px">${s > 1 ? `<button class="btn sm" data-act="step" data-s="${s - 1}">← ${esc(steps[s - 2])}</button>` : '<span></span>'}${s < 5 ? `<button class="btn sm primary" data-act="step" data-s="${s + 1}">${esc(steps[s])} →</button>` : '<span></span>'}</div>`;
  const layout = b === 'desk' ? `<div style="display:grid;grid-template-columns:260px minmax(0,1fr) 260px;gap:18px;align-items:start">${facts}<div style="min-width:0">${step}${stepNav}</div>${result}</div>`
    : b === 'tab' ? `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:18px;align-items:start"><div class="stack">${facts}${result}</div><div style="min-width:0">${step}${stepNav}</div></div>`
    : `<div class="stack">${s === 1 || s === 5 ? facts : ''}<div>${step}${stepNav}</div>${result}</div>`;
  return `${opening('Phase 3 · classify and test', 'Classify and test', bl ? 'Blind re-derivation: set the tier from the facts alone.' : 'One entry at a time: authority, consequence, rung, obtainability, blind re-derivation.')}${picker}${srcList()}${stepTabs}${layout}${gateCard(3)}${stepbar(gate(gates()[3].ok, gates()[3].ok ? 'Phase 3 met' : 'Phase 3 open'))}`;
}

/* ---------- S6 questions to counsel ---------- */
const DET = { 1: [['yes', 'Yes'], ['no', 'No']], 2: [['yes', 'Yes'], ['no', 'No']], 3: [['passive', 'Passive'], ['significant', 'Significant influence'], ['contractual', 'Contractual'], ['control', 'Control or board seat']] };
const detLabel = (n, v) => ((DET[n] || []).find(x => x[0] === v) || [, v])[1];
const newestFor = q => newest(S.questions.filter(x => x.status === 'answered' && x.entryId === q.entryId && String(x.targetField) === String(q.targetField)));
function askForm(prefix) {
  const A = UI.ask || {}, es = A.arrangementId ? S.entries.filter(e => e.arrangementId === A.arrangementId) : S.entries;
  return `<div class="fgrid">
    <label class="f" for="${prefix}-arr"><span>Arrangement</span><select class="in" id="${prefix}-arr" data-ask="arrangementId">${S.arrangements.map(a => `<option value="${esc(a.id)}" ${A.arrangementId === a.id ? 'selected' : ''}>${esc(a.id)}</option>`).join('')}</select></label>
    <label class="f" for="${prefix}-ent"><span>Entry</span><select class="in" id="${prefix}-ent" data-ask="entryId"><option value="">—</option>${es.map(e => `<option value="${esc(e.id)}" ${A.entryId === e.id ? 'selected' : ''}>${esc(e.id)}</option>`).join('')}</select></label>
    <label class="f" for="${prefix}-q7"><span>Which of the ${T('seven', 'seven questions')}</span><select class="in" id="${prefix}-q7" data-ask="question7">${[1, 2, 3, 4, 7].map(n => `<option ${String(A.question7) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="f" for="${prefix}-tf"><span>Determination goes to field</span><select class="in" id="${prefix}-tf" data-ask="targetField"><option value="">None</option>${['23', '24', '25'].map(n => `<option value="${n}" ${A.targetField === n ? 'selected' : ''}>${n} ${esc(FLD(n).name)}</option>`).join('')}</select></label></div>
    <div class="stack" style="gap:10px;margin-top:12px"><label class="f" for="${prefix}-facts"><span>Facts · what the documents show, with sources, no characterisation</span><textarea class="in" id="${prefix}-facts" data-ask="facts">${esc(A.facts || '')}</textarea></label><label class="f" for="${prefix}-qq"><span>Question · one, answerable with a determination</span><textarea class="in" id="${prefix}-qq" data-ask="question">${esc(A.question || '')}</textarea></label><label class="f" for="${prefix}-why"><span>Why it matters to the assessment</span><input class="in" id="${prefix}-why" data-ask="why" value="${esc(A.why || '')}"></label></div>
    <button class="btn sm primary" style="margin-top:12px" data-act="addQ">Add to question log</button>`;
}
function screenCounsel() {
  const b = bp(), awhy = deny('ask');
  const qStatus = q => badge(q.status === 'openWithOwner' ? 'open · ' + (pname(q.owner) || 'owner?') : q.status, q.status === 'answered' ? 'b-green' : 'b-ochre');
  const detail = (q, i) => {
    const e = ent(q.entryId), tf = q.targetField ? String(q.targetField) : '', f = e && tf ? e.fields[tf] : null, applied = f && f.source === q.ref, nw = tf && e ? newestFor(q) : null, superseded = nw && nw !== q, n7 = +q.question7, anw = deny('answer'), base = 'q-' + sid(q.ref);
    return `<div class="card" style="margin-top:10px" id="${base}"><div class="row between"><strong class="mono">${esc(q.ref)}</strong>${qStatus(q)}</div>
      <div class="grid2" style="margin-top:10px"><div><div class="mini">ARRANGEMENT · ENTRY · QUESTION</div><div class="small">${esc(q.arrangementId)} · ${esc(q.entryId || '—')} · Q${esc(q.question7)}</div><div class="mini" style="margin-top:8px">FACTS</div><div class="small">${esc(q.facts)}</div><div class="mini" style="margin-top:8px">WHY IT MATTERS</div><div class="small">${esc(q.why)}</div></div>
      <div><div class="mini">QUESTION</div><div>${esc(q.question)}</div>${q.sentOn ? `<div class="mini" style="margin-top:8px">Sent ${esc(q.sentOn)}</div>` : ''}</div></div>
      ${q.status === 'answered' ? `<div class="panel2" style="margin-top:12px"><div class="mini">RESPONSE · ${esc(q.respondedOn)} · ${q.transcribedBy ? 'transcribed by ' + esc(pname(q.transcribedBy)) : 'entered by counsel'}${q.determination ? ' · determination: ' + esc(detLabel(n7, q.determination)) : ''}${q.reach ? ' · ' + (q.reach === 'none' ? 'no reasonable reach' : 'reasonable reach') : ''}</div><p style="margin:6px 0 0;white-space:pre-wrap">${esc(q.response)}</p></div>
        ${e && tf && !applied ? (superseded ? `<p class="small" style="margin-top:8px;color:var(--ochre)">A newer answered question (${esc(nw.ref)}) exists for ${esc(q.entryId)} field ${esc(tf)}. Only the newest answer can be recorded.</p>` : `<div class="card" style="margin-top:12px"><h3 class="sh">Record determination in field ${esc(tf)} · ${esc(FLD(tf).name)}</h3>
          ${tf === '24' ? `<label class="f" for="${base}-det"><span>Rights held</span><select class="in" id="${base}-det">${['Passive', 'Significant influence', 'Contractual', 'Control or board seat'].map(x => `<option>${x}</option>`).join('')}</select></label>` : ''}
          ${tf === '25' ? `<div class="fgrid"><label class="f" for="${base}-det"><span>Required rung</span><select class="in" id="${base}-det">${EV.map(r => `<option value="${r}">${r} ${esc(rungName(r))}</option>`).join('')}</select></label><label class="f" for="${base}-grade"><span>Grading</span><select class="in" id="${base}-grade"><option>requirement</option><option>expectation</option><option>better view</option></select></label></div>` : ''}
          ${tf === '23' ? '<p class="small soft">Counsel\u2019s wording is recorded verbatim from the response.</p>' : ''}
          <button class="btn sm primary" style="margin-top:10px" data-act="applyDet" data-i="${i}" ${anw ? 'disabled' : ''}>Record in field ${esc(tf)}</button>${whyNote(anw)}</div>`) : applied ? `<p class="small" style="margin-top:8px;color:var(--green)">Recorded in ${esc(q.entryId)} field ${esc(tf)}. Locked; a change needs a new answered question.</p>` : ''}`
      : anw ? whyNote(anw) : `<div style="margin-top:12px"><label class="f" for="${base}-resp"><span>${has('counsel') ? 'Response · counsel\u2019s wording' : T('transcribed', 'Transcribe') + ' counsel\u2019s written response'}</span><textarea class="in" id="${base}-resp" placeholder="${has('counsel') ? '' : 'Paste verbatim'}"></textarea></label>
        <div class="fgrid" style="margin-top:8px">${DET[n7] ? `<label class="f" for="${base}-detq"><span>Counsel's determination on question ${n7}</span><select class="in" id="${base}-detq"><option value="">—</option>${DET[n7].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>` : ''}<label class="f" for="${base}-reach"><span>Reach determination, if counsel gives one</span><select class="in" id="${base}-reach"><option value="">None given</option><option value="none">No reasonable reach</option><option value="reach">Reasonable reach</option></select></label></div>
        ${has('counsel') ? '' : `<label class="cb small" style="margin-top:6px"><input type="checkbox" id="${base}-verb"> Pasted verbatim from counsel's written response</label>`}
        <button class="btn sm primary" style="margin-top:8px" data-act="answerQ" data-i="${i}">${has('counsel') ? 'Record response' : 'Record transcription'}</button>
        ${UI.err['q' + i] ? `<p class="err" role="alert">${esc(UI.err['q' + i])}</p>` : ''}
        <div class="row" style="margin-top:12px"><select class="in" id="${base}-own" style="width:auto" aria-label="Owner">${peopleOpts('', 'Owner').map(o => `<option value="${esc(o[0])}" ${q.owner === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select><button class="btn sm ghost" data-act="openOwner" data-i="${i}">Record as open with owner</button></div></div>`}</div>`;
  };
  const rows = S.questions.map((q, i) => b === 'phone' ? `<div class="card" style="padding:14px"><div class="row between"><button class="lnk mono" id="qo-${sid(q.ref)}" data-act="qOpen" data-r="${esc(q.ref)}">${esc(q.ref)}</button>${qStatus(q)}</div><div class="small soft">${esc(q.arrangementId)} · ${esc(q.entryId || '—')} · Q${esc(q.question7)}</div><p class="small" style="margin:6px 0 0">${esc(q.question)}</p>${UI.qOpen === q.ref ? detail(q, i) : ''}</div>`
    : `<tr><td class="code"><button class="lnk mono" id="qo-${sid(q.ref)}" data-act="qOpen" data-r="${esc(q.ref)}" aria-expanded="${UI.qOpen === q.ref}">${esc(q.ref)}</button></td><td class="code">${esc(q.arrangementId)}<br>${esc(q.entryId)}</td>${b === 'desk' ? `<td class="code">Q${esc(q.question7)}</td>` : ''}<td class="small">${esc(q.question)}</td>${b === 'desk' ? `<td class="small">${esc((q.response || '').slice(0, 90))}${(q.response || '').length > 90 ? '…' : ''}</td>` : ''}<td>${qStatus(q)}</td></tr>${UI.qOpen === q.ref ? `<tr><td colspan="${b === 'desk' ? 6 : 4}" style="background:var(--parchment)">${detail(q, i)}</td></tr>` : ''}`).join('');
  const form = awhy ? whyNote(awhy) : b === 'phone' ? `<div class="row" style="margin-top:18px"><button class="btn sm primary" id="openAsk" data-act="sheet" data-s="ask">New question to counsel</button></div>` : `<section class="card" style="margin-top:18px" id="askForm"><h2 class="sh">New ${T('qc', 'question to counsel')}</h2>${askForm('ask')}</section>`;
  return `${opening('Phase 4 · questions to counsel', 'Questions to counsel', 'Anything that turns on what the law requires goes to counsel as a numbered question. Never answered in a working paper.')}
  ${S.questions.length ? (b === 'phone' ? `<div class="stack" style="gap:10px">${rows}</div>` : `<div class="tw"><table class="lg"><thead><tr><th>Ref</th><th>ARR · REG</th>${b === 'desk' ? '<th>Q</th>' : ''}<th>Question</th>${b === 'desk' ? '<th>Response</th>' : ''}<th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`) : '<p class="soft">No questions yet. Use <em>ask counsel</em> beside any register field, or the form below.</p>'}
  ${form}${gateCard(4)}${stepbar(gate(gates()[4].ok, gates()[4].ok ? 'Phase 4 met' : 'Phase 4 open'))}`;
}

/* ---------- worksheets and S7 findings ---------- */
const tbl = (h, rows) => '| ' + h.join(' | ') + ' |\n| ' + h.map(() => '---').join(' | ') + ' |\n' + rows.map(r => '| ' + r.map(x => String(x == null || x === '' ? '—' : x).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |').join('\n') + '\n\n';
const fvs = (e, n) => { const f = e.fields[n]; if (!f) return ''; if (f.notKnown) return 'not known'; return optL(f.value) + (f.detail ? ' · ' + f.detail : ''); };
function worksheetParts(a) {
  const es = S.entries.filter(e => e.arrangementId === a.id), fd = finding(a), qs = S.questions.filter(q => q.arrangementId === a.id), P_ = [];
  const add = (k, title, md) => P_.push({ k, title, md: `**${k}. ${title}.** ${md}` });
  add('A', 'Identification', `${a.id} · parties: ${a.parties || '—'} · boundaries: ${(a.boundaries || []).join(', ') || '—'} · reason selected: ${a.reason || '—'} · preparer: ${es.map(e => pname(e.classifiedBy)).filter(Boolean).join(', ') || '—'} · reviewer: ${es.map(e => pname(e.peerReview.personId)).filter(Boolean).join(', ') || '—'} · ${calLabel()}\n\n`);
  add('B', 'Chain map', '\n\n' + tbl(['Entry', 'Boundary', 'Where AI acts', 'Supplier', 'Platform behind it', 'Location'], es.map(e => [e.id, fvs(e, 3), fvs(e, 4), fvs(e, 8), fvs(e, 9), fvs(e, 10)])));
  add('C', 'Facts', '\n\n' + es.map(e => tbl(['Field', e.id, 'Source'], [4,5,6,7,8,9,10,11,12,13,14].map(n => [n + ' ' + FLD(n).name, fvs(e, n), (e.fields[n] || {}).source]))).join(''));
  add('D', 'Classification', '\n\n' + tbl(['Entry', 'Tier', 'Consequence', 'Rationale'], es.map(e => [e.id, fv(e, 15) ? fv(e, 15) + ' ' + tierName(fv(e, 15)) : '', fv(e, 16) ? fv(e, 16) + ' ' + consName(fv(e, 16)) : '', [e.tierOverrideReason, (e.fields[16] || {}).source].filter(Boolean).join(' · ') + (e.peerReview.tier ? ` · peer re-derived ${e.peerReview.tier}${e.peerReview.differs ? ', resolution: ' + e.peerReview.resolution : ''}` : '')])));
  add('E', 'Ladder', '\n\n' + tbl(['Entry', rungLabel(), 'Adjustment and reason', 'Received today'], es.map(e => { const x = expected(e); return [e.id, x ? x.value : '', x ? x.adjustment : '', fvs(e, 18)]; })));
  add('F', 'Obtainability', '\n\n' + es.map(e => { const R = e.obtainability.rungs || {}, ob = obResult(e); return (ob.none ? '' : tbl(['Rung', ...C.tests.map(t => t.id + ' ' + t.name)], Object.keys(R).sort().reverse().map(r => [r, ...C.tests.map(t => R[r][t.id] ? (R[r][t.id].pass ? 'pass' : 'fail') + (R[r][t.id].source ? ' (' + R[r][t.id].source + ')' : '') : '')]))) + `${e.id}: ${ob.none ? e0Msg().charAt(0).toLowerCase() + e0Msg().slice(1) + '; E0, no tests' : 'obtainable ' + (ob.done ? ob.rung : 'not yet tested') + ' · confidence ' + (confidence(e) || '—') + ' (proposed ' + (proposedConfidence(e) || '—') + (e.confChosen && e.confRaiseReason ? '; raised: ' + e.confRaiseReason : '') + ')'}${needsRetest(e) ? ' · marked for re-test' : ''}\n\n`; }).join(''));
  add('G', 'Questions to counsel', '\n\n' + (qs.length ? tbl(['Ref', 'Question', 'Sent', 'Response', 'Received'], qs.map(q => [q.ref, q.question, q.sentOn, q.response || q.status, q.respondedOn])) : 'None.\n\n'));
  add('H', 'Counsel\u2019s determinations', '\n\n' + tbl(['Entry', '23 Nexus, relationship, location', '24 Rights', '25 Required rung'], es.map(e => [e.id, ...[23, 24, 25].map(n => e.fields[n] ? fvs(e, n) + ' (' + e.fields[n].source + ')' : 'awaiting counsel')])));
  let I = fd.type ? fd.type + ' ' + findingName(fd.type) : fd.label || '—';
  if (fd.type === 'F2') I += ` · gap ${fd.gap} ${fd.gap === 1 ? 'rung' : 'rungs'} (required ${fd.required}, obtainable ${fd.obtainable}) · priority ${fd.priority} (${fd.priorityBasis}) · failed test ${fd.failedTest || '—'} · gap owner ${a.findingOwner || fd.owner} · routes available: ${fd.routes.join('; ')}${fd.due ? ' · due: ' + fd.due + ' · interim position: ' + fd.interim : ''}`;
  if (fd.type === 'F1') I += ` · obtainable ${fd.obtainable} meets required ${fd.required} · owner ${a.findingOwner || '—'}`;
  if (fd.type === 'F3') I += ` · counsel's determination ${fd.ref}: ${fd.basis || ''} · technical classification: ${es.map(e => e.id + ' ' + (fv(e, 15) || '—') + '/' + (fv(e, 16) || '—')).join(', ')}`;
  if (fd.type === 'F4') { const ne = ent(fd.entry); I += ` · question that would resolve it: ${fd.question || '—'} · who could answer: ${fd.who || '—'}${ne && f4Period(ne) ? ' · F4 allowed to stand (P6, ' + bandOf(ne) + '): ' + f4Period(ne) : ''}`; }
  const fl = es.flatMap(e => flags(e).map(x => e.id + ': ' + x.label));
  add('I', 'Finding', I + `\n\n**Flags, reported beside the finding.** ${fl.length ? fl.join('; ') : cal() ? 'None.' : 'Uncalibrated, no flags.'}\n\n`);
  const nk = es.flatMap(e => Object.entries(e.fields).filter(([, f]) => f && f.notKnown).map(([n]) => `${e.id} field ${n} ${FLD(n).name}`));
  add('J', 'Not known', (nk.length ? nk.join('; ') : 'None.') + '\n\n');
  return P_;
}
function worksheetMd(a, h) { return `${h || '###'} Worksheet ${a.id}: ${a.name || ''}\n\n` + worksheetParts(a).map(p => p.md).join(''); }
function screenFindings() {
  const b = bp(), cc = concentration();
  const hid = a => S.entries.filter(e => e.arrangementId === a.id && blindFor(e));
  const sum = S.arrangements.map(a => { const h = hid(a), fd = h.length ? { type: null, label: 'hidden' } : finding(a), es = S.entries.filter(e => e.arrangementId === a.id), w = ent(fd.entry) || es[0], fl = h.length ? [] : es.flatMap(e => flags(e));
    return { a, h, fd, w, fl, cells: [a.id, h.length ? 'hidden' : w ? fv(w, 15) : '', w ? fv(w, 16) : '', h.length ? 'hidden' : w && expected(w) ? expected(w).value : '', w ? fv(w, 25) : '', h.length ? '' : w && obResult(w).done ? obResult(w).rung : '', fd.priority || ''] }; });
  const conc = cc ? `<div class="calstrip"><span class="small">${T('concentration', 'Concentration')}: ${cc.platform ? `${esc(cc.onTop)} of ${esc(cc.ops)} critical operations (${esc(cc.share)}%) rest on ${esc(cc.platform)}` : 'no platform known'}${cc.limit != null ? ` · limit ${esc(cc.limit)}%` : ''}${cc.unknowns.length ? ' · unknown platform: ' + esc(cc.unknowns.join(', ')) : ''}</span>${cc.over ? badge('over limit', 'b-red') : cc.limit != null ? badge('within limit', 'b-green') : badge('no limit (P9)', 'b-grey')}</div>` : '';
  const ws = s => { if (s.h.length) return `<p class="small" style="margin-top:12px;color:var(--aubergine)">Hidden until you record your R3 tier for ${esc(s.h.map(e => e.id).join(', '))}.</p>`; const parts = worksheetParts(s.a);
    return b === 'phone' ? `<div class="stack" style="gap:6px;margin-top:12px">${parts.map(p => `<details class="pr"><summary>${p.k}. ${esc(p.title)}</summary><div class="md" style="padding:0 16px 14px">${mdToHtml(p.md)}</div></details>`).join('')}</div>`
      : `<details class="pr" style="margin-top:14px" open><summary>Worksheet · parts A to J</summary><div class="md" style="padding:0 20px 18px">${mdToHtml(parts.map(p => p.md).join(''))}</div></details>`; };
  return `${opening('Phase 5 · findings and report', 'Findings', 'One finding per arrangement. Flags sit beside the finding, never inside it.')}
  ${conc}
  ${S.arrangements.length ? (b === 'phone' ? `<div class="stack" style="gap:10px">${sum.map(s => `<div class="card" style="padding:14px"><div class="row between"><span class="mono" style="font-weight:600">${esc(s.a.id)}</span>${badge(s.fd.type || s.fd.label || '—', findingCls(s.fd.type))}</div><div class="row" style="gap:6px;margin-top:6px">${s.cells.slice(1).filter(Boolean).map(x => badge(x, 'b-grey')).join('')}${s.fl.map(x => badge(x.label, x.cls)).join('')}</div></div>`).join('')}</div>`
    : `<div class="tw"><table class="lg"><thead><tr><th>ARR</th><th>Tier</th><th>Cons</th><th>${esc(rungLabel())}</th><th>Required</th><th>Obtainable</th><th>Priority</th><th>Finding</th><th>Flags</th></tr></thead><tbody>${sum.map(s => `<tr>${s.cells.map((c, k) => k === 6 ? '' : `<td class="code">${esc(c || '—')}</td>`).join('')}<td class="code">${esc(s.fd.priority || '—')}</td><td>${badge(s.fd.type || s.fd.label || '—', findingCls(s.fd.type))}</td><td>${s.fl.map(x => badge(x.label, x.cls)).join(' ')}</td></tr>`).join('')}</tbody></table></div>`) : '<p class="soft">No arrangements.</p>'}
  <div class="stack" style="margin-top:22px">${sum.map(s => `<section class="card" id="ws-${sid(s.a.id)}"><div class="row between"><div><div class="eyebrow">${esc(s.a.id)} · ${esc((s.a.boundaries || []).join(' · '))}</div><div style="font:600 20px/1.2 var(--serif)">${esc(s.a.name || '')}</div></div>
      <span class="badge ${findingCls(s.fd.type)}" style="font-size:18px;padding:8px 16px">${esc(s.fd.type ? s.fd.type + ' · ' + findingName(s.fd.type) : s.fd.label || '—')}</span></div>
      ${s.fl.length ? `<div class="panel2" style="margin-top:12px;padding:10px 14px"><div class="mini" style="margin-bottom:6px">FLAGS · SEPARATE FROM THE EVIDENCE FINDING</div><div class="row">${s.fl.map(x => badge(x.label, x.cls)).join('')}</div></div>` : ''}
      ${s.fd.type === 'F3' ? `<p class="small" style="margin-top:10px">Technical classification beside the conclusion: ${esc(S.entries.filter(e => e.arrangementId === s.a.id).map(e => `${e.id} ${fv(e, 15) || '—'} / ${fv(e, 16) || '—'}`).join(' · '))}</p>` : ''}
      ${s.h.length ? '' : `<div class="fgrid" style="margin-top:12px">${fld('Named gap owner · field 26', `arrangements.${arrIdx(s.a)}.findingOwner`, s.a.findingOwner || s.fd.owner || '')}</div>`}
      ${ws(s)}</section>`).join('')}</div>
  ${gateCard(5)}${stepbar(gate(gates()[5].ok, gates()[5].ok ? 'Phase 5 met' : 'Phase 5 open'))}`;
}

/* ---------- S8 review ---------- */
/* R5 hits are keyed by phrase and source text, so clearing one clears it in every output built from that text. */
let OUTC = { rev: -1, s: null, map: {}, hits: null }, REV = 0;
function outCache() { if (OUTC.rev !== REV || OUTC.s !== S) OUTC = { rev: REV, s: S, map: {}, hits: null }; return OUTC; }
function outText(o) { const c = outCache(), k = o.id + '|' + (RAW ? 'raw' : FORCE || 'view'); if (!(k in c.map)) c.map[k] = o.gen(); return c.map[k]; }
const nz = s => String(s).toLowerCase().replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim();
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
function textSources() {
  const src = [], add = (id, label, t) => { if (t != null && String(t).trim()) src.push({ id, label, text: String(t) }); };
  S.entries.forEach(e => { Object.entries(e.fields).forEach(([n, f]) => { if (!f) return; add(`${e.id}.f${n}`, `${e.id} field ${n}`, f.value); add(`${e.id}.f${n}.d`, `${e.id} field ${n} detail`, f.detail); add(`${e.id}.f${n}.s`, `${e.id} field ${n} source`, f.source); });
    add(e.id + '.override', e.id + ' override reason', e.tierOverrideReason); add(e.id + '.raise', e.id + ' confidence reason', e.confRaiseReason); add(e.id + '.ndq', e.id + ' F4 question', e.notDeterminable.question); add(e.id + '.ndw', e.id + ' F4 who', e.notDeterminable.who); add(e.id + '.res', e.id + ' R3 resolution', e.peerReview.resolution);
    (e.dl3Rows || []).forEach((r, j) => { add(`${e.id}.dl3.${j}.c`, `${e.id} DL3 category ${j + 1}`, r.category); add(`${e.id}.dl3.${j}.r`, `${e.id} DL3 record ${j + 1}`, r.record); });
    Object.entries(e.obtainability.rungs || {}).forEach(([r, t]) => Object.entries(t || {}).forEach(([k, v]) => add(`${e.id}.${r}.${k}`, `${e.id} ${r} ${k} source`, v && v.source))); });
  S.arrangements.forEach(a => ['name', 'parties', 'reason', 'findingOwner'].forEach(k => add(`${a.id}.${k}`, `${a.id} ${k}`, a[k])));
  S.questions.forEach(q => ['facts', 'question', 'why', 'response'].forEach(k => add(`${q.ref}.${k}`, `${q.ref} ${k}`, q[k])));
  Object.entries(S.engagement.annexText || {}).forEach(([k, v]) => add('annex.' + k, 'Annex section ' + k, v));
  S.exceptions.forEach(x => ['departure', 'reason'].forEach(k => add(`${x.ref}.${k}`, `${x.ref} ${k}`, x[k])));
  ['insurer', 'reference', 'privilegeMarking', 'irOrganisation', 'counselFirm'].forEach(k => add('eng.' + k, 'Set-up ' + k, S.engagement[k]));
  S.documents.forEach(d => add('doc.' + d.id, 'Document ' + d.id, d.title)); S.interviews.forEach(v => { add('iv.' + v.id, 'Interview ' + v.id, v.who); add('ivn.' + v.id, 'Interview ' + v.id + ' notes', v.notesRef); });
  return src;
}
const normLine = s => String(s).replace(/^[\s|>*#-]+/, '').replace(/\s+/g, ' ').trim().slice(0, 240);
/* R5 hits are keyed by phrase and the source of the text (entry and field, or the fixed paragraph), so one hit is listed once with every output it appears in. */
function legalHits() {
  const c = outCache(); if (c.hits) return c.hits;
  const phrases = (S.engagement.legalPhrases || []).map(p => String(p).trim().toLowerCase()).filter(Boolean), by = {};
  let texts; RAW = true; try { texts = OUTS.map(o => [o.id, nz(outText(o)), outText(o)]); } finally { RAW = false; }
  const srcs = textSources().map(s => Object.assign(s, { n: nz(s.text) })).sort((x, y) => y.n.length - x.n.length);
  srcs.forEach(s => phrases.forEach(p => { if (!s.n.includes(p)) return; const probe = s.n.slice(0, 80), outs = texts.filter(t => t[1].includes(probe)).map(t => t[0]); if (!outs.length) return; const key = p + '|' + s.id + '|' + hash(s.text); by[key] = { key, phrase: p, source: s.label, line: s.text.trim().slice(0, 240), outs }; }));
  texts.forEach(([oid, , raw]) => raw.split('\n').forEach(line => { let rest = nz(line); if (!phrases.some(p => rest.includes(p))) return; srcs.forEach(s => { if (s.n && rest.includes(s.n)) rest = rest.split(s.n).join(' '); }); phrases.forEach(p => { if (!rest.includes(p)) return; const text = normLine(line), key = p + '|fixed|' + hash(text); (by[key] = by[key] || { key, phrase: p, source: 'Fixed text', line: text, outs: [] }); if (!by[key].outs.includes(oid)) by[key].outs.push(oid); }); }));
  c.hits = Object.values(by).map(h => Object.assign(h, { cleared: !!S.r5Cleared[h.key] })); return c.hits;
}
const r5Clear = () => legalHits().every(h => h.cleared);
function screenReview() {
  const hits = legalHits(), e = S.engagement, irOpen = S.independentReviewPoints.filter(p => p.status === 'open').length, broken = brokenRefs(), hideText = blindEntries().length > 0;
  const r3 = S.entries.filter(x => x.peerReview.tier).length, r3d = S.entries.filter(x => x.peerReview.differs && !String(x.peerReview.resolution || '').trim()).length;
  const st = (ok, l) => badge(l, ok ? 'b-green' : 'b-grey');
  const btn = (act, label, why, extra) => `<button class="btn sm" data-act="${act}" ${extra || ''} ${why ? 'disabled title="' + esc(why) + '"' : ''}>${label}</button>${why ? `<div class="mini" style="max-width:220px">${esc(why)} ${T('roleLimits', 'Why')}</div>` : ''}`;
  const row = (id, status, action) => { const d = C.reviews.find(r => r.id === id), r = rev(id); return `<tr><td class="code">${id}</td><td><strong class="small">${esc(d.name)}</strong><div class="mini">${esc(d.tests)}</div></td><td class="small">${esc(id === 'R7' ? (e.independentReviewerReportsTo === 'cro' ? 'Independent reviewer; confirmed by the CRO' : 'Independent reviewer, through counsel') : d.reviewer)}</td><td>${status}</td><td class="small">${esc(pname(r.by) || r.by)}${r.on ? '<br>' + esc(r.on) : ''}${r.notes ? '<div class="mini">' + esc(r.notes) + '</div>' : ''}</td><td>${action || ''}</td></tr>`; };
  const r7why = deny('r7') || (irOpen ? irOpen + ' review ' + (irOpen === 1 ? 'point is' : 'points are') + ' still open.' : '');
  const rows = [
    row('R1', st(gates()[1].items[0][1], gates()[1].items[0][1] ? 'agreed' : 'not agreed'), '<button class="lnk mono" data-act="go" data-to="set">Set</button>'),
    row('R2', st(rev('R2').result === 'passed', rev('R2').result || 'not run'), btn('runR2', 'Run completeness check', deny('r2'))),
    row('R3', st(S.entries.length && r3 === S.entries.length && !r3d, `${r3}/${S.entries.length} re-derived${r3d ? ' · ' + r3d + ' unresolved' : ''}`), '<button class="lnk mono" data-act="classifyEntry" data-step="5">Classify step 5</button>'),
    row('R4', st(rev('R4').result === 'passed', rev('R4').result || 'not recorded'), deny('r4') ? btn('recR4', 'Passed', deny('r4')) : `<div class="row"><button class="btn sm" data-act="recR4" data-r="passed">Passed</button><button class="btn sm ghost" data-act="recR4" data-r="exceptions">Exceptions</button></div>`),
    row('R5', st(r5Clear(), hits.length ? `${hits.filter(h => !h.cleared).length} of ${hits.length} hits open` : 'no hits'), '<a class="lnk mono" href="#r5">hits</a>'),
    row('R6', st(!!rev('R6').on, rev('R6').on ? 'recorded' : 'not recorded'), btn('recR6', 'Record counsel review', deny('r6'))),
    row('R7', st(rev('R7').result === 'complete', rev('R7').result || `${irOpen} points open`), btn('recR7', 'Confirm R7 complete', r7why))
  ].join('');
  return `${opening('Phase 6 · review', 'Quality control and independent check', 'Seven review points, the legal-line check, the exceptions log and the independent reviewer\u2019s points.')}
  <div class="tw"><table class="lg"><thead><tr><th>#</th><th>Review</th><th>Reviewer</th><th>Status</th><th>By · on</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  ${broken.length ? `<section class="card" style="margin-top:18px;border-color:var(--red)"><h2 class="sh" style="color:var(--red)">Broken references · ${broken.length}</h2><p class="small soft">These items point to something that is not in the file. The phase 2 gate stays closed until each is fixed.</p><div class="tw"><table class="lg"><thead><tr><th>Item</th><th>Where</th><th>Points to</th></tr></thead><tbody>${broken.map(x => `<tr><td class="code">${esc(x.item)}</td><td class="small">${esc(x.where)}</td><td class="code">${esc(x.ref)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
  <section class="card" id="r5" style="margin-top:18px"><h2 class="sh">R5 · ${T('legalline', 'Legal-line check')}</h2><p class="small soft">Scans every draft output for wording that states what the law requires. Each hit is keyed by phrase and source text, so clearing it once clears it in every output that carries that text. Final export stays blocked until every hit is cleared.</p>
    ${fld('Phrase list · one per line, maintained by the method owner', 'engagement.legalPhrasesText', (e.legalPhrases || []).join('\n'), { area: true })}
    ${hits.length ? `<div class="stack" style="gap:8px;margin-top:12px">${hits.map((h, k) => `<div class="panel2" style="padding:10px 14px"><div class="row between"><span class="mono">“${esc(h.phrase)}” · ${esc(h.source)} · in ${esc(h.outs.join(', '))}</span>${h.cleared ? badge('cleared', 'b-green') : `<button class="btn sm" id="clr-${k}" data-act="clearHit" data-k="${esc(h.key)}" ${deny('r5') ? 'disabled title="' + esc(deny('r5')) + '"' : ''}>Clear</button>`}</div><div class="small" style="margin-top:4px">${hideText ? '<em>Text hidden during blind re-derivation.</em>' : esc(h.line)}</div></div>`).join('')}</div>` : '<p class="small" style="color:var(--green);margin-top:10px">No hits in the current drafts.</p>'}</section>
  <section class="card" style="margin-top:18px"><div class="row between"><h2 class="sh" style="margin:0">Exceptions log</h2><button class="btn sm" data-act="addExc" ${deny('tri') ? 'disabled title="' + esc(deny('tri')) + '"' : ''}>Add exception</button></div>${whyNote(deny('tri'))}
    <div class="stack" style="gap:10px;margin-top:12px">${S.exceptions.map((x, i) => `<div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${fld(x.ref + ' · departure', `exceptions.${i}.departure`, x.departure)}${fld('Reason', `exceptions.${i}.reason`, x.reason)}${fld('Approved by', `exceptions.${i}.approvedBy`, x.approvedBy, { select: peopleOpts() })}${fld('Date', `exceptions.${i}.on`, x.on, { type: 'date' })}</div>`).join('') || '<p class="small soft">None.</p>'}</div></section>
  <section class="card" style="margin-top:18px"><div class="row between"><h2 class="sh" style="margin:0">${T('ir', 'Independent review')} points</h2><button class="btn sm" data-act="addIR" ${deny('irLog') ? 'disabled title="' + esc(deny('irLog')) + '"' : ''}>Add point</button></div>${whyNote(deny('irLog'))}
    <p class="small soft">The independent reviewer logs each point. Triodian responds. Only the independent reviewer closes or discloses a point.</p>
    <div class="stack" style="gap:10px;margin-top:12px">${S.independentReviewPoints.map((x, i) => `<div class="panel2" style="padding:12px 14px"><div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${fld(x.ref + ' · output', `independentReviewPoints.${i}.output`, x.output, { select: [['', '—'], ...OUTS.map(o => [o.id, o.id + ' ' + o.name])] })}${fld('Section', `independentReviewPoints.${i}.section`, x.section)}${fld('Status', `independentReviewPoints.${i}.status`, x.status, { select: [['open', 'Open'], ['closed', 'Closed'], ['disclosed', 'Disclosed']] })}</div><div class="grid2" style="margin-top:8px">${fld('Point', `independentReviewPoints.${i}.point`, x.point, { area: true })}${fld('Response', `independentReviewPoints.${i}.response`, x.response, { area: true })}</div></div>`).join('') || '<p class="small soft">None logged.</p>'}</div></section>
  ${gateCard(6)}${stepbar(gate(gates()[6].ok, gates()[6].ok ? 'Phase 6 met' : 'Phase 6 open'))}`;
}
/* ---------- outputs ---------- */
let RAW = false, FORCE = '';
const FREQ = { E0: 'n/a', E1: 'On change, or annually', E2: 'Per reporting period', E3: 'On event, within an agreed time', E4: 'On demand or scheduled', E5: 'Each window', E6: 'Each action, reported in aggregate' };
/* An output is final only when R5 is cleared, the phase 5 gate passes and its own gate passes. */
const finalWhy = o => !r5Clear() ? 'R5 legal-line hits are still open.' : !gates()[5].ok ? 'The phase 5 gate is not met.' : !gates()[o.gate].ok ? `The phase ${o.gate} gate is not met.` : '';
const outFinal = o => !finalWhy(o);
const outStatus = o => FORCE === 'draft' ? 'Draft' : FORCE === 'final' ? 'Final' : outFinal(o) ? 'Final' : 'Draft';
function mdHead(o) {
  const e = S.engagement, st = RAW ? '' : outStatus(o);
  return `${e.privilegeMarking || '[Privilege marking not recorded in set-up]'}\n\n# ${o.id} · ${o.name}\n\n**${calLabel()}**${st ? ' · ' + st : ''} · ${today()}${e.example ? ' · WORKED EXAMPLE, FICTIONAL' : ''}\n\n${e.insurer || '[Insurer]'} · ${e.reference || '[reference]'}\n\n`;
}
const OUTS = [
  { id: 'DL1', name: 'AI dependency register', gate: 3, gen: genDL1 }, { id: 'DL2', name: 'Evidence obtainable at each boundary', gate: 5, gen: genDL2 },
  { id: 'DL3', name: "Control-library shape for the insurer's own AI boundary", gate: 5, gen: genDL3 }, { id: 'DL4', name: 'Technical schedule, tolerance and trigger design', gate: 5, gen: genDL4 },
  { id: 'DL5', name: 'Technical annex', gate: 6, gen: genDL5 }, { id: 'DL6', name: 'Hand-back list', gate: 2, gen: genDL6 },
  { id: 'QS', name: 'Question set to counsel', gate: 3, gen: genQS }, { id: 'RP', name: 'Review pack for the independent reviewer', gate: 5, gen: genRP },
  { id: 'CM', name: 'Closing measures', gate: 7, gen: genCM }, { id: 'DR', name: 'Difference report', gate: 0, gen: genDR }
];
const O = id => OUTS.find(o => o.id === id) || OUTS[0];
function fieldOut(e, n) {
  const a = arr(e.arrangementId) || {};
  if (n === 1) return e.id; if (n === 2) return e.arrangementId;
  if (n === 17) return (expected(e) || {}).value || '';
  if (n === 21) { const ob = obResult(e); return ob.done ? ob.rung : 'not known'; }
  if (n === 22) { const ob = obResult(e); return ob.none ? 'n/a (E0 expected)' : confidence(e) || 'not known'; }
  if (n === 26) { const f = finding(a); return (f.type ? f.type + ' ' + findingName(f.type) : f.label || 'not yet set') + (a.findingOwner || f.owner ? ' · owner: ' + (a.findingOwner || f.owner) : ''); }
  return fvs(e, n);
}
const fieldSrc = (e, n) => n === 17 ? (expected(e) || {}).adjustment : n === 21 || n === 22 ? 'Obtainability test' : n === 26 ? 'Finding' : (e.fields[n] || {}).source;
function summaryTable() { return tbl(['Arrangement', 'Tier', 'Consequence', rungLabel(), 'Required', 'Obtainable', 'Finding', 'Priority', 'Flags'], S.arrangements.map(a => { const fd = finding(a), es = S.entries.filter(e => e.arrangementId === a.id), w = ent(fd.entry) || es[0]; return [a.id, w && fv(w, 15), w && fv(w, 16), w && expected(w) ? expected(w).value : '', w && fv(w, 25), w && obResult(w).done ? obResult(w).rung : '', fd.type || fd.label, fd.priority, es.flatMap(e => flags(e).map(x => x.label)).join('; ')]; })); }
function genDL1() {
  let m = mdHead(O('DL1')) + `All entries, all 26 fields, with sources. Not-known fields: ${S.entries.reduce((n, e) => n + notKnownCount(e), 0)}.\n\n`;
  S.entries.forEach(e => { m += `## ${e.id} · ${e.arrangementId}\n\n` + tbl(['#', 'Field', 'Value', 'Source'], C.fields.map(d => [d.n, FLD(d.n).name, fieldOut(e, d.n), fieldSrc(e, d.n)])) + `Flags: ${flags(e).map(x => x.label).join('; ') || 'none'} · not known: ${notKnownCount(e)}\n\n`; });
  m += `## Source index\n\n` + tbl(['ID', 'Document', 'Status', 'Date'], S.documents.map(d => [d.id, d.title, d.status, d.date])) + tbl(['ID', 'Interview', 'Date', 'Notes'], S.interviews.map(v => [v.id, v.who, v.date, v.notesRef]));
  return m;
}
function dl1Csv() {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', o = O('DL1');
  const head = ['Entry', 'Arrangement', ...C.fields.map(d => d.n + ' ' + FLD(d.n).name), ...C.fields.map(d => d.n + ' source'), 'Flags', 'Not known'];
  return [[S.engagement.privilegeMarking || '[Privilege marking not recorded]'], [calLabel()], [outStatus(o) + ' · ' + today()], [(S.engagement.insurer || '[Insurer]') + ' · ' + (S.engagement.reference || '')], [],
    head, ...S.entries.map(e => [e.id, e.arrangementId, ...C.fields.map(d => fieldOut(e, d.n)), ...C.fields.map(d => fieldSrc(e, d.n)), flags(e).map(x => x.label).join('; '), notKnownCount(e)])].map(r => r.map(q).join(',')).join('\n');
}
function genDL2() { return mdHead(O('DL2')) + `## Summary\n\n` + summaryTable() + `## Worksheets\n\n` + S.arrangements.map(a => worksheetMd(a)).join(''); }
function genDL3() {
  const b3 = S.entries.filter(e => fv(e, 3) === 'B3');
  return mdHead(O('DL3')) + `For B3 entries only: the categories of rule the insurer would need to state for its own staff's use, and the record each would produce (framework section 10.1). Shape only, with no product specified. The framework does not list the categories; each is stated here from the insurer's own policy (D2) and licence terms (D8).\n\n` + (b3.length ? b3.map(e => `## ${e.id} · ${fvs(e, 7)}\n\nWhat the AI does: ${fvs(e, 11)}\n\nCredentials and systems it can change: ${fvs(e, 13) || '—'}\n\n` + tbl(['Category of rule', 'Record it would produce'], (e.dl3Rows || []).length ? e.dl3Rows.map(r => [r.category, r.record]) : [['[To be stated from D2]', '[To be stated]']]) + `Evidence the system could produce (field 19): ${fvs(e, 19) || '—'}\n\n`).join('') : 'No B3 entries in the set.\n\n');
}
function genDL4() {
  const p10 = P('P10'), rows = [], all = p10 ? p10.map(t => t.ref) : [];
  S.arrangements.forEach(a => { const fd = finding(a); if (fd.type !== 'F1' && fd.type !== 'F2') return; const r = fd.type === 'F1' ? fd.obtainable : fd.required, refs = Array.isArray(a.dl4Triggers) ? a.dl4Triggers.filter(x => all.includes(x)) : all;
    rows.push([a.id, `${r} ${rungName(r)}`, (C.rungs.find(x => x.code === r) || {}).def, FREQ[r], p10 ? (refs.join(', ') || 'none selected') : '[Set by the board in P10]', fd.type === 'F2' ? 'Gap: ' + (fd.failedTest || '—') + ' failed' : 'Obtainable']); });
  return mdHead(O('DL4')) + `For each F1 and F2: the evidence item, its contents, frequency, the tolerance it is measured against, and the triggers and their timing. Written to sit beside counsel's flow-down clauses.\n\n## Tolerances and triggers (P10)\n\n` + (p10 ? tbl(['Ref', 'Trigger', 'Measure', 'Threshold', 'Time', 'Recipient'], p10.map(t => [t.ref, t.trigger, t.measure, t.threshold || '[not set]', t.hours != null ? t.hours + ' hours' : '[not set]', t.recipient || '[not set]'])) : '[Set by the board in P10]\n\n') + `## Evidence items\n\n` + (rows.length ? tbl(['Arrangement', 'Evidence item', 'Contents', 'Frequency', 'Tolerance and triggers (P10 refs)', 'Basis'], rows) : 'No F1 or F2 findings yet.\n\n');
}
function genDL5() {
  const e = S.engagement, A = e.annexText || {}, nk = S.arrangements.map(a => a.id + ': ' + S.entries.filter(x => x.arrangementId === a.id).reduce((n, x) => n + notKnownCount(x), 0)).join('; ');
  const fails = {}; S.entries.forEach(x => Object.values(x.obtainability.rungs || {}).forEach(t => C.tests.forEach(k => { if (t[k.id] && t[k.id].pass === false) { const key = k.id + ' at ' + (fv(x, 3) || '?'); fails[key] = (fails[key] || 0) + 1; } })));
  const gen = [`The assessment answers what evidence about AI can reach ${e.insurer || 'the insurer'} at each boundary in the set, and how firmly.`, 'No data was processed. No provider was approached. No production system was accessed. No legal advice is given.', S.arrangements.map(a => `${a.id} ${a.name}: ${a.reason || '—'}`).join('\n\n'), 'Register of 26 fields per entry; the seven questions in order; the evidence ladder E0 to E6; the five-part obtainability test T1 to T5. ' + calLabel() + '.', summaryTable(), S.arrangements.map(a => { const fd = finding(a); return `${a.id}: ${fd.type ? fd.type + ' ' + findingName(fd.type) : fd.label || '—'}${fd.priority ? ', priority ' + fd.priority : ''}`; }).join('\n\n'), Object.keys(fails).length ? Object.entries(fails).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') : 'No failed tests recorded.', S.arrangements.map(a => { const fd = finding(a); return fd.type === 'F2' ? `${a.id}: ${fd.routes.join('; ')}` : ''; }).filter(Boolean).join('\n\n') || 'No gaps recorded.', `Not-known fields by arrangement: ${nk || '—'}. Obtainable rungs by confidence: ${CONF.map(c => c + ' ' + S.entries.filter(x => confidence(x) === c).length).join(', ')}.`, 'Register extract (DL1), question log (QS), source index (DL1), exceptions log.'];
  let m = mdHead(O('DL5')) + `In Triodian's name.\n\n`;
  C.annexOutline.forEach((t, k) => { m += `## ${k + 1}. ${t}\n\n${gen[k]}\n\n${A[k + 1] ? A[k + 1] + '\n\n' : '[Method owner\u2019s text]\n\n'}`; });
  m += `## Exceptions log\n\n` + (S.exceptions.length ? tbl(['Ref', 'Departure', 'Reason', 'Approved by', 'Date'], S.exceptions.map(x => [x.ref, x.departure, x.reason, pname(x.approvedBy), x.on])) : 'None.\n\n');
  m += `Signed for Triodian: ${e.annexSigned.by ? pname(e.annexSigned.by) + ', method owner, ' + e.annexSigned.on : '[not signed]'}\n`;
  return m;
}
function genDL6() { const h = S.entries.filter(e => ['no', 'partly'].includes(fv(e, 6))); return mdHead(O('DL6')) + `AI uses found that are not on the insurer's inventory, for the inventory owner.\n\n` + (h.length ? tbl(['Entry', 'Arrangement', 'On inventory', 'System', 'Supplier', 'What the AI does', 'Source'], h.map(e => [e.id, e.arrangementId, fvs(e, 6), fvs(e, 7), fvs(e, 8), fvs(e, 11), (e.fields[6] || {}).source])) : 'None found.\n\n') + `Accepted: ${S.engagement.handBack.by ? pname(S.engagement.handBack.by) + ', ' + S.engagement.handBack.on : '[not yet accepted]'}\n`; }
function genQS() { const q = S.questions.filter(x => x.status !== 'answered'); return mdHead(O('QS')) + (q.length ? q.map(x => `## ${x.ref}\n\n` + tbl(['Field', 'Contents'], [['Arrangement and entry', `${x.arrangementId} · ${x.entryId || '—'}`], ['Which of the seven questions', x.question7], ['Facts', x.facts], ['Question', x.question], ['Why it matters to the assessment', x.why], ['Response', x.response || ''], ['Status', x.status + (x.owner ? ' · ' + pname(x.owner) : '')]])).join('') : 'No open questions.\n\n'); }
function genRP() { const e = S.engagement, cro = pname(e.croPersonId), to = e.independentReviewerReportsTo === 'cro' ? `the CRO${cro ? ', ' + cro : ''}` : `counsel${e.counselFirm ? ', ' + e.counselFirm : ''}`; const strip = s => s.split('\n').slice(4).join('\n'); return mdHead(O('RP')) + `Addressed to ${to}, for the independent reviewer${e.irOrganisation ? ' (' + e.irOrganisation + ')' : ''}. The reviewer's queries and Triodian's answers pass through the same line. R7 is confirmed by ${e.independentReviewerReportsTo === 'cro' ? 'the CRO' : 'the independent reviewer, through counsel'}.\n\n---\n\n` + strip(genDL1()) + '\n---\n\n' + strip(genDL2()) + '\n---\n\n' + strip(genDL5()); }
function genCM() {
  const es = S.entries, cnt = (f) => { const o = {}; es.forEach(e => { const k = f(e); if (k) o[k] = (o[k] || 0) + 1; }); return Object.entries(o).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'; };
  const ft = {}; es.forEach(e => Object.values(e.obtainability.rungs || {}).forEach(t => C.tests.forEach(k => { if (t[k.id] && t[k.id].pass === false) { const key = k.id + '/' + (fv(e, 3) || '?'); ft[key] = (ft[key] || 0) + 1; } })));
  const cc = concentration();
  return mdHead(O('CM')) + tbl(['Measure', 'Result'], [['Entries by boundary type and authority tier', cnt(e => (fv(e, 3) || '?') + ' ' + (fv(e, 15) || '?'))], ['Fields not known, by arrangement', S.arrangements.map(a => a.id + ': ' + es.filter(e => e.arrangementId === a.id).reduce((n, e) => n + notKnownCount(e), 0)).join(' · ')], ['Findings by type and priority', S.arrangements.map(a => { const f = finding(a); return a.id + ' ' + (f.type || f.label || '—') + (f.priority ? ' ' + f.priority : ''); }).join(' · ')], ['Obtainable rungs by confidence level', cnt(e => confidence(e))], ['Failed tests by type and boundary', Object.entries(ft).map(([k, n]) => k + ': ' + n).join(' · ') || '—'], ['Classifier and reviewer differences', es.filter(e => e.peerReview.differs).length + ' of ' + es.filter(e => e.peerReview.tier).length + ' re-derived'], ['Questions to counsel: sent, answered, open', `${S.questions.length}, ${S.questions.filter(q => q.status === 'answered').length}, ${S.questions.filter(q => q.status !== 'answered').length}`]])
    + `## Calibration flags\n\n` + (cal() ? tbl(['Entry', 'Flags'], es.map(e => [e.id, flags(e).map(x => x.label).join('; ') || 'none'])) + (cc ? `Concentration: ${cc.platform ? cc.onTop + ' of ' + cc.ops + ' critical operations (' + cc.share + '%) on ' + cc.platform : 'no platform known'}${cc.limit != null ? ', limit ' + cc.limit + '%' : ', no limit set'}${cc.unknowns.length ? '; unknown platform: ' + cc.unknowns.join(', ') : ''}.\n` : '') : 'Uncalibrated. No flags.\n');
}
function genDR() { return mdHead(O('DR')) + (S.diffReports.length ? S.diffReports.slice().reverse().map(d => `## ${d.from} → ${d.to} · ${fmtAt(d.at)}\n\nParameters changed: ${(d.changedParameters || []).join(', ') || 'none'}. Facts, classifications, test results and counsel's determinations are unchanged.\n\n` + (d.changes.length ? tbl(['Item', 'What', 'From', 'To', 'Why'], d.changes.map(c => [c.item, c.what, c.from, c.to, c.why])) : 'No result changed.\n\n')).join('') : 'No calibration version change recorded.\n'); }
function withMode(mode, fn) { FORCE = mode; try { return fn(); } finally { FORCE = ''; } }
function screenOutputs() {
  const bl = blindEntries();
  if (bl.length) return `${opening('Phase 7 · outputs and close', 'Outputs', '')}<div class="card"><p style="margin:0">Outputs carry every classification, so they are hidden until you record your R3 tier for ${esc(bl.map(e => e.id).join(', '))}.</p></div>${stepbar()}`;
  const o = O(UI.outTab), md = outText(o), fwhy = finalWhy(o), e = S.engagement, b3 = S.entries.filter(x => fv(x, 3) === 'B3');
  const dl = inFrame ? '<span class="small soft">Downloads are not available in this viewer. Use Copy, or open the file directly in a browser.</span>'
    : `<button class="btn sm" id="out-draft" data-act="dlOut" data-m="draft">Export draft (.md)</button><button class="btn sm primary" id="out-final" data-act="dlOut" data-m="final" ${fwhy ? 'disabled title="' + esc(fwhy) + '"' : ''}>Export final (.md)</button>${o.id === 'DL1' ? '<button class="btn sm" id="out-csv" data-act="dlCsv">Download .csv</button><button class="btn sm aub" id="out-ext" data-act="dlExtract">Register extract (.json)</button>' : ''}`;
  return `${opening('Phase 7 · outputs and close', 'Outputs', 'Every output carries the privilege marking, the calibration status and version, draft or final, and the date.')}
  <div class="tabs" role="tablist">${OUTS.map(x => `<button role="tab" id="otab-${x.id}" aria-selected="${o.id === x.id}" data-act="outTab" data-t="${x.id}">${x.id}</button>`).join('')}</div>
  <div class="row between" style="margin-bottom:12px"><div class="row"><strong>${esc(o.name)}</strong>${badge(fwhy ? 'draft' : 'final', fwhy ? 'b-grey' : 'b-green')}${fwhy ? `<span class="small" style="color:var(--red)">Final export blocked: ${esc(fwhy)} ${T('legalline', 'Why')}</span>` : ''}</div>
    <div class="row"><button class="btn sm" id="out-copy" data-act="copyOut">Copy markdown</button>${o.id === 'DL1' ? '<button class="btn sm ghost" id="out-cpx" data-act="cpExtract">Copy extract</button>' : ''}${dl}</div></div>
  ${o.id === 'DL3' ? `<details class="pr" style="margin-bottom:12px"><summary>Categories of rule for each B3 entry</summary><div class="stack" style="padding:0 20px 18px">${b3.length ? b3.map(x => { const i = eIdx(x); return `<div><div class="mini">${esc(x.id)} · ${esc(fv(x, 7))}</div>${(x.dl3Rows || []).map((r, j) => `<div class="fgrid" style="margin-top:6px">${fld('Category of rule', `entries.${i}.dl3Rows.${j}.category`, r.category)}${fld('Record it would produce', `entries.${i}.dl3Rows.${j}.record`, r.record)}</div>`).join('')}<button class="btn sm" style="margin-top:6px" data-act="addDl3" data-id="${esc(x.id)}" ${deny('tri') ? 'disabled title="' + esc(deny('tri')) + '"' : ''}>Add category</button></div>`; }).join('') : '<p class="small soft">No B3 entries.</p>'}${whyNote(deny('tri'))}</div></details>` : ''}
  ${o.id === 'DL4' && P('P10') ? `<details class="pr" style="margin-bottom:12px"><summary>P10 triggers that apply to each item</summary><div class="stack" style="padding:0 20px 18px">${S.arrangements.filter(a => ['F1', 'F2'].includes(finding(a).type)).map(a => { const ai = arrIdx(a), all = P('P10').map(t => t.ref), sel = Array.isArray(a.dl4Triggers) ? a.dl4Triggers : all; return `<div><div class="mini">${esc(a.id)} · ${esc(a.name)}</div><div class="row" style="gap:4px 14px">${all.map(r => `<label class="cb small"><input type="checkbox" id="dl4-${sid(a.id)}-${sid(r)}" data-arrchk="arrangements.${ai}.dl4Triggers" value="${esc(r)}" ${sel.includes(r) ? 'checked' : ''} ${deny('tri') ? 'disabled' : ''}>${esc(r)}</label>`).join('')}</div></div>`; }).join('') || '<p class="small soft">No F1 or F2 findings yet.</p>'}${whyNote(deny('tri'))}</div></details>` : ''}
  ${o.id === 'DL5' ? `<details class="pr" style="margin-bottom:12px"><summary>Method owner's text for each section</summary><div class="stack" style="padding:0 20px 18px">${C.annexOutline.map((t, k) => fld(`${k + 1}. ${t}`, `engagement.annexText.${k + 1}`, (e.annexText || {})[k + 1] || '', { area: true })).join('')}<div class="row">${e.annexSigned.by ? badge('signed · ' + pname(e.annexSigned.by), 'b-green') : `<button class="btn sm" data-act="signAnnex" ${deny('sign') ? 'disabled' : ''}>Sign the annex</button>${whyNote(deny('sign'))}`}</div></div></details>` : ''}
  ${o.id === 'DL6' ? `<div class="row" style="margin-bottom:12px">${e.handBack.by ? badge('accepted · ' + pname(e.handBack.by) + ' · ' + e.handBack.on, 'b-green') : `<button class="btn sm" data-act="acceptHB" ${deny('handBack') ? 'disabled' : ''}>Accept hand-back list</button>${whyNote(deny('handBack'))}`}</div>` : ''}
  ${o.id === 'DL1' ? `<p class="small soft">${T('handback', 'The register extract')} goes to the AI Risk Appetite app for check K10. It holds function, location, tier, consequence and the rung currently received per entry. No facts, sources or client wording.</p>` : ''}
  <div class="card md" aria-label="Preview">${mdToHtml(md)}</div>${gateCard(7)}${stepbar()}`;
}

/* ---------- S10 reference ---------- */
function screenReference() {
  const q = UI.refQ.trim().toLowerCase(), p2 = P('P2');
  const gl = Object.entries(C.glossary).filter(([, g]) => !q || (g.term + ' ' + g.def).toLowerCase().includes(q)).sort((a, b) => a[1].term.localeCompare(b[1].term));
  const t = (h, rows) => `<div class="tw" style="margin-bottom:22px"><table class="lg"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, k) => `<td class="${k === 0 ? 'code' : 'small'}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `${opening('Reference', 'Questions, scales, tests and glossary', 'The AI Use Assessment Framework, ' + esc(C.frameworkDate) + ', updated for the changes in the build specification, section 0.2. Read-only.')}
  <h2 class="sh">The ${T('seven', 'seven questions')}</h2>${t(['#', 'Question', 'Answer scale', 'Determined by', 'Facts Triodian supplies', 'Fields'], C.questions7.map(x => [x.n, esc(x.q), esc(x.scale), esc(x.by), esc(x.facts || ''), esc(x.fields)]))}
  <h2 class="sh">${T('tier', 'Authority tiers')}</h2>${t(['Code', 'Tier', 'Definition', 'Deciding test'], C.tiers.map(x => [x.code, esc(x.name), esc(x.def), esc(x.test)]))}
  <h2 class="sh">${T('consequence', 'Failure consequence')}</h2>${t(['Code', 'Consequence', 'Meaning', 'Insurer\u2019s threshold (P2)'], C.consequences.map(x => [x.code, esc(x.name), esc(x.def), p2 && typeof p2 === 'object' ? esc(Object.entries(p2).filter(([k]) => k.startsWith(x.code)).map(([, v]) => v).join('; ') || '—') : 'uncalibrated']))}
  <h2 class="sh">${T('rung', 'Evidence ladder')}</h2>${t(['Code', 'Rung', 'Also called', 'What the insurer holds', 'Produced by', 'Frequency'], C.rungs.map(x => [x.code, esc(x.name), esc(x.alt || ''), esc(x.def), esc(x.producedBy || ''), esc(FREQ[x.code])]))}
  <h2 class="sh">${T('obtest', 'Obtainability test')}</h2>${t(['#', 'Condition', 'Question'], C.tests.map(x => [x.id, esc(x.name), esc(x.q)]))}
  <h2 class="sh">Finding types</h2>${t(['Code', 'Finding', 'Condition'], C.findings.map(x => [x.code, esc(x.name), esc(x.cond)]))}
  <h2 class="sh">Deliverables</h2>${t(['#', 'Deliverable', 'Contents', 'Accepted when'], (C.deliverables || []).map(x => [esc(x.id), esc(x.name), esc(x.contents), esc(x.accepted)]))}
  <section style="margin-bottom:28px"><div class="row between"><h2 class="sh" style="margin:0">Glossary</h2><input class="in" id="refq" data-act="refq" type="search" value="${esc(UI.refQ)}" placeholder="Search terms" style="max-width:280px" aria-label="Search glossary"></div>
    <div class="tw" style="margin-top:12px"><table class="lg"><tbody>${gl.map(([id, g]) => `<tr id="g-${id}" class="fwsec"><td style="width:220px;font-weight:600">${esc(g.term)}</td><td class="small">${linkify(g.def)}</td><td class="small soft" style="width:180px">${esc(g.where)}</td></tr>`).join('') || '<tr><td>No match.</td></tr>'}</tbody></table></div></section>
  <section><h2 class="sh">Framework text</h2><div class="card md">${mdToHtml(C.frameworkMarkdown || '', true)}</div></section>`;
}

/* ---------- markdown ---------- */
function mdToHtml(md, anchors) {
  const L = md.split('\n'); let h = '', i = 0;
  const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>').replace(/\\([\[\]|])/g, '$1');
  const isBlock = l => /^(#{1,4} |\s*\||\s*([-*]|\d+\.) |---\s*$)/.test(l);
  const split = r => { const out = []; let cur = ''; const s = r.trim().replace(/^\|/, '').replace(/\|$/, ''); for (let k = 0; k < s.length; k++) { if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++; } else if (s[k] === '|') { out.push(cur.trim()); cur = ''; } else cur += s[k]; } out.push(cur.trim()); return out; };
  while (i < L.length) {
    const l = L[i];
    if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length, t = l.slice(n + 1); const id = anchors ? ` id="fw-${t.toLowerCase().replace(/[^a-z0-9]+/g, '-')}" class="fwsec"` : ''; h += `<h${n}${id}>${inl(t)}</h${n}>`; i++; continue; }
    if (/^\s*\|/.test(l)) { const rows = []; while (i < L.length && /^\s*\|/.test(L[i])) rows.push(L[i++]); const head = split(rows[0]); h += '<table><thead><tr>' + head.map(c => `<th>${inl(c)}</th>`).join('') + '</tr></thead><tbody>' + rows.slice(2).map(r => '<tr>' + split(r).map(c => `<td>${inl(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>'; continue; }
    if (/^\s*([-*]|\d+\.) /.test(l)) { const ol = /^\s*\d+\./.test(l), items = []; while (i < L.length && /^\s*([-*]|\d+\.) /.test(L[i])) items.push(L[i++].replace(/^\s*([-*]|\d+\.) /, '').replace(/^\[( |x)\] /, (m, x) => x === 'x' ? '☑ ' : '☐ ')); h += (ol ? '<ol>' : '<ul>') + items.map(t => `<li>${inl(t)}</li>`).join('') + (ol ? '</ol>' : '</ul>'); continue; }
    if (/^---\s*$/.test(l)) { h += '<hr>'; i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para = []; while (i < L.length && L[i].trim() && !isBlock(L[i])) para.push(L[i++]); h += `<p>${inl(para.join(' '))}</p>`;
  }
  return h;
}


/* ---------- popovers and sheets ---------- */
let popAnchor = null;
function openPop(id, anchor) { closePop(true); popAnchor = anchor; UI.pop = { stack: [id] }; anchor.setAttribute('aria-expanded', 'true'); renderPop(); }
function closePop(silent) {
  const r = document.getElementById('poproot'); if (r) r.innerHTML = '';
  if (popAnchor) { popAnchor.setAttribute('aria-expanded', 'false'); if (!silent && document.body.contains(popAnchor)) popAnchor.focus(); }
  UI.pop = null; if (!silent) popAnchor = null;
}
function renderPop() {
  const root = document.getElementById('poproot'); if (!UI.pop) { root.innerHTML = ''; return; }
  const id = UI.pop.stack[UI.pop.stack.length - 1], g = C.glossary[id], back = UI.pop.stack.length > 1;
  const inner = `<div class="ptop">${back ? '<button class="lnk mono" data-pact="back">← back</button>' : '<span class="mini">TERM</span>'}<button class="iconbtn" data-pact="close" aria-label="Close">✕</button></div>
    <h4 id="pop-h">${esc(g.term)}</h4><p class="small" style="margin:0">${linkify(g.def)}</p><div class="where"><strong>Where it is used:</strong> ${esc(g.where)}</div><button class="lnk small" data-pact="more" data-id="${id}">Read more</button>`;
  if (bp() === 'phone') {
    root.innerHTML = `<div class="sheet-bg" data-pact="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pop-h"><div class="handle" data-pact="drag" aria-hidden="true"></div>${inner}</div>`;
  } else {
    root.innerHTML = `<div class="pop" id="popcard" role="dialog" aria-labelledby="pop-h"><span class="ptr"></span>${inner}</div>`;
    const pop = root.firstChild, r = popAnchor.getBoundingClientRect(), z = UI.present && bp() === 'desk' ? 1.2 : 1;
    const ph = pop.offsetHeight, w = 320, sx = scrollX / z, sy = scrollY / z, vw = innerWidth / z, vh = innerHeight / z;
    const rl = r.left / z, rt = r.top / z, rb = r.bottom / z, rw = r.width / z;
    let left = Math.min(Math.max(rl + rw / 2 - w / 2, 8), vw - w - 8) + sx, above = rb + ph + 20 > vh && rt > ph + 20;
    pop.style.left = left + 'px'; pop.style.top = (above ? rt - ph - 10 : rb + 10) + sy + 'px';
    const ptr = pop.querySelector('.ptr'); ptr.style.left = (rl + rw / 2 + sx - left - 6) + 'px';
    if (above) { ptr.style.bottom = '-7px'; ptr.style.transform = 'rotate(225deg)'; } else ptr.style.top = '-7px';
  }
  const cl = root.querySelector('[data-pact="close"].iconbtn'); if (cl) cl.focus({ preventScroll: true });
}

function download(name, text, mime) {
  try { const blob = new Blob([text], { type: mime || 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Downloading ' + name); return true; }
  catch (e) { toast('Download blocked here. Use Copy instead.'); return false; }
}
function copyText(text) {
  const done = () => toast('Copied to clipboard');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed. Select the markdown and copy it manually.'); } ta.remove(); }
}
const slug = s => (s || 'engagement').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);


/* ---------- render ---------- */
let lastBp = null, inChange = false, pendingRender = false, LEAVING = false;
function render() { if (inChange) { if (!pendingRender) { pendingRender = true; setTimeout(() => { pendingRender = false; doRender(); }, 0); } return; } doRender(); }
const dsKey = el => el && el !== document.body && el.dataset && Object.keys(el.dataset).length ? el.tagName + '|' + JSON.stringify(Object.assign({}, el.dataset)) : null;
function doRender() {
  const app = document.getElementById('app'); lastBp = bp();
  if (!S) { app.innerHTML = entryOverlay(); return; }
  if (UI.personId && !person(UI.personId) && (practice() || !SRV.user)) UI.personId = '';
  if (S && !practice()) applyIdentity();
  const ae = document.activeElement, fid = ae && ae.id, fkey = !fid ? dsKey(ae) : null; let sel = null; try { if (ae && ae.selectionStart != null) sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) {}
  const s = UI.screen, G = gates(), gi = { setup: 0, set: 1, register: 2, classify: 3, counsel: 4, findings: 5, review: 6, outputs: 7 }[s];
  const scr = { setup: screenSetup, overview: screenOverview, set: screenSet, register: screenRegister, classify: screenClassify, counsel: screenCounsel, findings: screenFindings, review: screenReview, outputs: screenOutputs, reference: screenReference }[s] || screenOverview;
  app.innerHTML = header() + `<main id="main" tabindex="-1"><div class="wrap">${scr()}</div></main>` + footer() + bottombar(gi != null ? gate(G[gi].ok, G[gi].ok ? 'Gate met' : 'Gate open') : '') + drawer();
  renderSheet();
  let el = fid ? document.getElementById(fid) : null;
  if (!el && fkey) el = [...document.querySelectorAll('[data-act],[data-path],[data-fv],[data-fs],[data-ob],[data-obs],[data-at],[data-ats],[data-filt],[data-ask],[data-arrchk],[data-cons],[data-fnk],[data-fd]')].find(x => dsKey(x) === fkey) || null;
  if (el && el.disabled && UI.lastCtl) el = document.getElementById(UI.lastCtl) || el;
  if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange && /text|search|textarea/.test(el.type || el.tagName.toLowerCase())) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
  document.documentElement.classList.toggle('present', UI.present && bp() === 'desk');
}
function renderSheet() {
  const root = document.getElementById('sheetroot'); if (!root) return;
  if (!S || !UI.sheet || bp() !== 'phone') { root.innerHTML = ''; return; }
  const title = UI.sheet === 'filters' ? 'Filters' : 'New question to counsel', body = UI.sheet === 'filters' ? `<div class="stack">${filterControls('sf')}</div>` : askForm('sask');
  root.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet tall" role="dialog" aria-modal="true" aria-label="${title}"><div class="row between" style="margin-bottom:10px"><strong>${title}</strong><button class="iconbtn" id="sheetClose" data-act="closeSheet" aria-label="Close">✕</button></div>${body}</div>`;
}
function toast(msg) { if (!msg) return; const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast'; clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = 'vh'; }, 3400); }
function go(to, fromPop) { const same = UI.screen === to; UI.screen = to; UI.drawer = false; UI.sheet = null; closePop(true); popAnchor = null; if (to !== 'register') UI.hist = null; if (!fromPop && !same) { try { if (!history.state) history.replaceState({ screen: to }, '', '#' + to); else history.pushState({ screen: to }, '', '#' + to); } catch (e) {} } render(); window.scrollTo(0, 0); }
function setPath(path, v) {
  const pt = pathTarget(path), why = deny(pt[0], pt[1]); if (why) { toast(why); return false; }
  if (path === 'engagement.legalPhrasesText') { S.engagement.legalPhrases = String(v).split('\n').map(x => x.trim()).filter(Boolean); log('legalPhrases', 'R5', null, S.engagement.legalPhrases.length + ' phrases'); return true; }
  const ks = path.split('.'), last = ks.pop(); let o = S; ks.forEach(k => { if (o[k] == null) o[k] = {}; o = o[k]; });
  const from = o[last]; if (from === v) return true; o[last] = v;
  if (/^entries\.\d+\.notDeterminable\.on$/.test(path) && v) { const nd = S.entries[+ks[1]].notDeterminable; if (!nd.since) nd.since = today(); }
  log('edit', path, typeof from === 'object' ? null : from, v); return true;
}
/* ---------- the server: sign-in identity, loading and saving ---------- */
const SRV = { checked: false, on: false, user: null, reason: '', code: '', exists: false, rev: 0, state: 'saved', err: '', timer: null, inflight: null, again: false, conflict: null, lastAt: '', lastBy: '', site: '' };
async function api(method, path, body) {
  let r;
  try { r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', redirect: 'manual', cache: 'no-store' }); }
  catch (e) { return { ok: false, status: 0, error: 'The server could not be reached. Check your connection.' }; }
  if (r.type === 'opaqueredirect' || r.status === 401) return { ok: false, status: 401, error: 'Your sign-in has expired. Reload the page to sign in again.' };
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) return { ok: false, status: r.status, error: (j && j.error) || ('The server returned an error (' + r.status + ').'), code: j && j.code, body: j };
  return { ok: true, status: r.status, body: j };
}
function practice() { return !!(S && S.engagement.example); }
const savesHere = () => SRV.on && S && !practice();
const canSetup = () => !!(SRV.user && (SRV.user.isAdmin || (SRV.user.roles || []).some(r => r === 'methodOwner' || r === 'delivery')));
function applyIdentity() { if (!SRV.user || practice()) return; UI.personId = SRV.user.id; }
function autosave() { if (!savesHere() || SRV.state === 'conflict') return; SRV.state = 'pending'; clearTimeout(SRV.timer); SRV.timer = setTimeout(saveNow, 1200); paintSave(); }
function conflictNames(paths) {
  if (!Array.isArray(paths) || !paths.length) return '';
  const name = p => p[0] === 'entries' && p[1] ? p[1] + (p[2] === 'fields' && p[3] ? ' · field ' + p[3] : p[2] ? ' · ' + p[2] : '') : p[0] === 'questions' ? 'a question to counsel' : p[0] === 'arrangements' ? 'arrangement ' + (p[1] || '') : p.slice(0, 2).join(' · ');
  return [...new Set(paths.map(name))].slice(0, 4).join('; ');
}
async function saveNow() {
  clearTimeout(SRV.timer); SRV.timer = null;
  if (!savesHere() || SRV.state === 'conflict') return;
  if (SRV.inflight) { SRV.again = true; return SRV.inflight; }
  const snap = S, text = JSON.parse(JSON.stringify(S)); delete text.loadNotes;
  SRV.state = 'saving'; paintSave();
  SRV.inflight = (async () => {
    const r = await api('PUT', '/api/engagement', { revision: SRV.rev, data: text });
    SRV.inflight = null;
    if (S !== snap) return;
    if (r.ok && r.body.merged && r.body.data) {
      let next = r.body.data;
      if (window.RAFMerge && JSON.stringify(S) !== JSON.stringify(text)) next = RAFMerge.merge3(text, JSON.parse(JSON.stringify(S)), next).data;
      try { const keep = { screen: UI.screen, entryId: UI.entryId, tab: UI.tab }; S = hydrate(next); Object.assign(UI, keep); applyIdentity(); } catch (e) { toast('Merged, but the result could not be shown. Reload the page.'); }
      toast('Saved, together with changes by ' + (r.body.mergedWith || 'someone else') + '.'); REV++; render();
    }
    if (r.ok) { SRV.rev = r.body.revision; SRV.exists = true; SRV.lastAt = r.body.updatedAt; SRV.lastBy = r.body.updatedBy; SRV.err = ''; if (SRV.again) { SRV.again = false; SRV.state = 'pending'; return saveNow(); } SRV.state = 'saved'; UI.dirty = false; }
    else if (r.status === 409) { SRV.state = 'conflict'; SRV.conflict = r.body || {}; const items = conflictNames(SRV.conflict.conflicts); SRV.err = r.error + (items ? ' Item: ' + items + '.' : ''); toast(SRV.err); }
    else { SRV.state = 'error'; SRV.err = r.error; toast('Not saved: ' + r.error); }
    SRV.again = false; paintSave();
  })();
  return SRV.inflight;
}
async function flushSave() { if (!savesHere()) return true; if (SRV.state === 'pending' || SRV.timer) await saveNow(); else if (SRV.inflight) await SRV.inflight; return SRV.state === 'saved'; }
function saveLabel() {
  if (!S) return null;
  if (practice()) return ['b-ochre', 'Practice · not saved', 'The worked example is for practice. Nothing here is saved.'];
  if (!SRV.on) return ['b-ochre', 'Not saved', 'The server is not reachable.'];
  return { saved: ['b-green', 'Saved', SRV.lastAt ? 'Saved ' + fmtAt(SRV.lastAt) + ' by ' + SRV.lastBy : 'Saved'], pending: ['b-grey', 'Saving…', 'Changes will be saved in a moment'], saving: ['b-grey', 'Saving…', 'Saving'], error: ['b-red', 'Not saved', SRV.err], conflict: ['b-red', 'Changed elsewhere', SRV.err] }[SRV.state] || ['b-grey', '', ''];
}
function saveChip() { const l = saveLabel(); if (!l || !l[1]) return ''; return `<button class="badge ${l[0]}" id="savechip" data-act="saveChip" title="${esc(l[2])}" style="cursor:pointer">${esc(l[1])}</button>`; }
function paintSave() { const el = document.getElementById('savechip'); if (el) el.outerHTML = saveChip(); }
async function loadReal(quiet) {
  const r = await api('GET', '/api/engagement');
  if (!r.ok) { if (!quiet) toast('Could not load the assessment: ' + r.error); return false; }
  SRV.exists = !!r.body.exists; SRV.rev = r.body.revision || 0; SRV.state = 'saved'; SRV.err = ''; SRV.conflict = null; SRV.lastAt = r.body.updatedAt || ''; SRV.lastBy = r.body.updatedBy || ''; SRV.people = r.body.people || [];
  UI.dirty = false;
  if (r.body.exists) { try { S = hydrate(r.body.data); } catch (e) { S = null; toast('The saved assessment could not be read: ' + e.message); return false; } applyIdentity(); REV++; }
  else S = null;
  return true;
}
async function refreshIfQuiet() {
  if (!savesHere() || SRV.state !== 'saved' || SRV.inflight || UI.pop || UI.sheet) return;
  const ae = document.activeElement; if (ae && (/TEXTAREA|SELECT/.test(ae.tagName) || (ae.tagName === 'INPUT' && !/checkbox|radio|button|submit/.test(ae.type)))) return;
  const r = await api('GET', '/api/engagement');
  if (!r.ok || !r.body.exists || r.body.revision === SRV.rev) return;
  const keep = { screen: UI.screen, entryId: UI.entryId, tab: UI.tab }; await loadReal(true); Object.assign(UI, keep); render(); toast('Updated with the latest saved changes from ' + (r.body.updatedBy || 'another user') + '.');
}
const LOGO = h => `<img class="logo" src="/triodian-logo.svg" alt="Triodian" style="height:${h}px;width:auto;display:block">`;
const initials = s => String(s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
function account() {
  const u = SRV.user; if (!u) return '';
  const roles = (u.roles || []).map(roleName).join(', ');
  return `<span class="acct"><button class="avatar-link" data-act="acct" aria-haspopup="menu" aria-expanded="${!!UI.acct}" title="${esc(u.name || u.email)}" aria-label="Account: ${esc(u.name || u.email)}"><span class="avatar" aria-hidden="true">${esc(initials(u.name || u.email))}</span></button>${UI.acct ? `<div class="acct-menu" role="menu">
    <div class="acct-who"><span class="avatar" aria-hidden="true">${esc(initials(u.name || u.email))}</span><div><strong>${esc(u.name || u.email)}</strong>${u.name ? `<div class="small soft">${esc(u.email)}</div>` : ''}<div class="small soft">${esc(roles || 'No role in this assessment')}${u.isAdmin ? ' · administrator' : ''}</div></div></div>
    <a role="menuitem" class="item" href="/profile/">Your profile</a>
    ${u.isAdmin ? '<a role="menuitem" class="item" href="/admin/">Admin · users and activity</a>' : ''}
    <button role="menuitem" class="item" data-act="go" data-to="reference">Reference</button>
    <a role="menuitem" class="item signout" href="/cdn-cgi/access/logout">Sign out</a></div>` : ''}</span>`;
}
function hydrate(o) {
  if (!o || o.schema !== 'triodian.aua.v1') throw new Error('Not an AUA assessment file (schema triodian.aua.v1 expected)');
  const why = validateFile(o); if (why) throw new Error(why);
  const d = newAssessment(), m = {};
  Object.keys(d).forEach(k => { const v = o[k], dv = d[k]; m[k] = v == null ? dv : Array.isArray(dv) ? (Array.isArray(v) ? v : dv) : dv && typeof dv === 'object' ? (v && typeof v === 'object' && !Array.isArray(v) ? Object.assign({}, dv, v) : dv) : v; });
  m.engagement.briefConfirmed = Object.assign({ by: '', on: '', ref: '' }, m.engagement.briefConfirmed); m.engagement.annexSigned = Object.assign({ by: '', on: '' }, m.engagement.annexSigned); m.engagement.handBack = Object.assign({ by: '', on: '' }, m.engagement.handBack);
  if (!Array.isArray(m.engagement.legalPhrases)) m.engagement.legalPhrases = C.legalPhrases.slice();
  if (m.setAgreed.on && !m.setAgreed.gcOn && m.setAgreed.gcBy) m.setAgreed.gcOn = m.setAgreed.on; if (m.setAgreed.on && !m.setAgreed.counselOn && m.setAgreed.counselBy) m.setAgreed.counselOn = m.setAgreed.on;
  m.people = m.people.map(p => Object.assign({ id: 'p' + uid(), name: '', organisation: '', roles: [] }, p, { roles: Array.isArray(p.roles) ? p.roles : [] }));
  m.arrangements = m.arrangements.map(a => Object.assign({ name: '', parties: '', boundaries: [], criteria: [], reason: '', nextContracting: '', function: '', findingOwner: '' }, a));
  m.questions = m.questions.map(q => { const x = Object.assign({ ref: '', arrangementId: '', entryId: '', question7: '', facts: '', question: '', why: '', response: '', respondedOn: '', status: 'open', owner: '' }, q); if (x.question7 == null || x.question7 === '') x.question7 = String(x.targetField) === '25' ? 7 : String(x.targetField) === '24' ? 3 : ''; return x; });
  m.loadNotes = []; const used = new Set(m.entries.map(e => e && e.id).filter(Boolean)); let nx = [...used].reduce((mx, id) => Math.max(mx, parseInt(String(id).slice(4), 10) || 0), 0);
  m.entries.forEach(e => { if (!e.id) { do { nx++; } while (used.has('REG-' + String(nx).padStart(3, '0'))); e.id = 'REG-' + String(nx).padStart(3, '0'); used.add(e.id); m.loadNotes.push({ item: e.id, ref: 'id assigned on load', where: 'Register entry' }); } });
  m.arrangements.forEach(a => { if (a.noReach && a.noReach.ref) { const q = m.questions.find(x => x.ref === a.noReach.ref); if (q) q.reach = 'none'; } delete a.noReach; });
  m.entries = m.entries.map(e => { const b = newEntry(e.arrangementId, e.id), x = Object.assign(b, e);
    x.fields = e.fields && typeof e.fields === 'object' ? e.fields : {}; x.peerReview = Object.assign(newEntry('', 'x').peerReview, e.peerReview); x.obtainability = Object.assign({ start: '', rungs: {} }, e.obtainability); x.obtainability.rungs = x.obtainability.rungs || {};
    x.notDeterminable = Object.assign({ on: false, question: '', who: '', since: '' }, e.notDeterminable); x.authorityTests = Array.isArray(e.authorityTests) && e.authorityTests.length === 4 ? e.authorityTests.map(t => Object.assign({ answer: null, source: '' }, t)) : b.authorityTests;
    if (!x.confChosen && e.confBasis) x.confChosen = { seen: 'high', described: 'medium', inferred: 'low' }[e.confBasis] || ''; delete x.confBasis; delete x.expectedRung; delete x.flags; delete x.confidence;
    x.dl3Rows = Array.isArray(e.dl3Rows) ? e.dl3Rows : []; if (e.b2Support) { if (!x.confRaiseReason) x.confRaiseReason = 'Supported at B2 (from earlier file)'; } delete x.b2Support; x.arrangementId = x.arrangementId || ''; return x; });
  m.reviews = C.reviews.map(r => Object.assign({ point: r.id, by: '', on: '', result: '', notes: '' }, (o.reviews || []).find(x => x.point === r.id)));
  m.findings = [];
  return m;
}
function snapshotForSave() {
  const o = JSON.parse(JSON.stringify(S));
  o.findings = S.arrangements.map(a => { const f = finding(a); return { arrangementId: a.id, type: f.type || null, label: f.label || '', gapSize: f.gap || 0, priority: f.priority || '', failedTest: f.failedTest || '', owner: a.findingOwner || f.owner || '', routes: f.routes || [], dueDate: f.due || '', interimPosition: f.interim || '' }; });
  o.entries.forEach((e, i) => { const x = S.entries[i], ex = expected(x); e.expectedRung = ex ? { value: ex.value, basis: ex.basis, adjustment: ex.adjustment } : null; e.flags = flags(x).map(f => ({ id: f.id, label: f.label })); e.confidence = confidence(x) || null; });
  o.savedAt = nowISO(); o.note = 'findings, expectedRung, flags and confidence are a record of what was shown. They are recomputed on load.'; return o;
}
function readJson(file, cb) { const fr = new FileReader(); fr.onload = () => { try { cb(JSON.parse(fr.result)); } catch (er) { toast('Could not read: ' + er.message); } }; fr.readAsText(file); }

/* ---------- worked example (fictional, after framework 8.5) ---------- */
function buildExample() {
  const X = newAssessment(), old = S; S = X;
  Object.assign(X.engagement, { insurer: 'Corvane General Insurance (fictional)', reference: 'AUA-CGI-2026-01', counselFirm: 'Askew Lane Partners (fictional)', privilegeMarking: 'Privileged and confidential · prepared at the direction of counsel · worked example', startDate: '2026-10-13', briefConfirmed: { by: 'p2', on: '2026-10-09', ref: 'Brief v1, 9 Oct 2026' }, documentsRequestedOn: '2026-10-09', irPersonId: 'p9', irOrganisation: 'Independent reviewer (fictional firm)', croPersonId: 'p10', example: true });
  X.people = [['p1', 'Meredith Vance', 'Askew Lane Partners', ['counsel']], ['p2', 'Helen Brandt', 'Corvane General · GC', ['gc']], ['p3', 'Ana Duarte', 'Corvane General · claims executive', ['owner']], ['p4', 'Sam Okoro', 'Triodian', ['methodOwner']], ['p5', 'Jordan Pike', 'Triodian', ['assessor']], ['p6', 'Ravi Menon', 'Triodian', ['peer']], ['p7', 'Elise Tan', 'Triodian', ['validation']], ['p8', 'Kit Morrow', 'Triodian', ['delivery']], ['p9', 'Lena Hartmann', 'Independent reviewer', ['ir']], ['p10', 'Priya Natarajan', 'Corvane General · CRO', ['cro']]].map(([id, name, organisation, roles]) => ({ id, name, organisation, roles }));
  X.documents.forEach(d => { d.status = 'received'; d.date = '2026-10-10'; });
  X.documents.push({ id: 'D5-ARR01', ref: 'D5', title: 'Claims management agreement, Harlow Claims Services', status: 'received', date: '2026-10-10' }, { id: 'D7-ARR01', ref: 'D7', title: 'Harlow due diligence response 2026', status: 'received', date: '2026-10-10' }, { id: 'D8-ARR02', ref: 'D8', title: 'Lexmere licence terms and security pack', status: 'received', date: '2026-10-10' }, { id: 'D6-ARR03', ref: 'D6', title: 'Fenwick binder delegated authority schedule', status: 'received', date: '2026-10-10' });
  X.interviews.forEach((v, i) => { v.date = '2026-10-1' + (4 + Math.min(i, 3)); v.notesRef = 'IN-0' + (i + 1); });
  X.arrangements = [
    { id: 'ARR-01', name: 'Outside claims manager · motor', parties: 'Corvane; Harlow Claims Services (fictional); Quillon Analytics (fictional)', boundaries: ['B1', 'B2'], criteria: ['2', '5'], reason: 'AI inside a provider; a triage model decides routing', nextContracting: '2027-03-31', function: 'Claims', findingOwner: '' },
    { id: 'ARR-02', name: 'Legal staff drafting assistant', parties: 'Corvane legal; Lexmere (fictional)', boundaries: ['B3'], criteria: ['4', '5'], reason: "Covers the insurer's own use; AI only assists", nextContracting: '2027-01-31', function: 'Legal and compliance', findingOwner: 'AI governance lead' },
    { id: 'ARR-03', name: 'Underwriting agency · SME property', parties: 'Corvane; Fenwick Underwriting (fictional)', boundaries: ['B1'], criteria: ['1', '2'], reason: 'Binder renewal in March sets a date', nextContracting: '2027-03-01', function: 'Underwriting and pricing', findingOwner: '' }];
  X.setAgreed = { gcBy: 'p2', gcOn: '2026-10-13', counselBy: 'p1', counselOn: '2026-10-13', on: '2026-10-13' };
  const mk = (arrId, f, extra) => { const e = newEntry(arrId); X.entries.push(e); Object.entries(f).forEach(([n, v]) => { e.fields[n] = Array.isArray(v) ? { value: v[0], source: v[1], notKnown: false, by: 'p5', on: '2026-10-16', detail: v[2] || '' } : { value: '', source: '', notKnown: true, by: 'p5', on: '2026-10-16' }; }); Object.assign(e, extra || {}); return e; };
  const pass = s => ({ pass: true, source: s }), fail = s => ({ pass: false, source: s });
  mk('ARR-01', { 3: ['B1', 'D3 p.4'], 4: ['provider', 'D5-ARR01 cl.2'], 5: ['Motor claims handling · critical operation: Claims payment', 'D3 p.4'], 6: ['yes', 'D1 row 14'], 7: ['Motor claims triage model', 'D7-ARR01 p.3'], 8: ['Harlow Claims Services Pty Ltd (fictional)', 'D5-ARR01 p.1'], 9: ['Quillon Analytics (fictional)', 'D7-ARR01 p.3'], 10: ['Harlow: Australia · Quillon: Australia', 'D5-ARR01 p.1'], 11: ['Routes each new motor claim to fast-track payment or investigation. No person reviews the routing.', 'D7-ARR01 p.3'], 12: ['decision', 'IV-2 2026-10-15'], 13: ['Read access to claims intake; no write access', 'D7-ARR01 p.4'], 14: ['cl.11.2: "The Insurer may audit the Manager\u2019s financial records relating to the Services." cl.14.1: material incidents notified within 5 business days.', 'D5-ARR01 p.14'], 15: ['A3', 'Q5 tests 1 to 3'], 16: ['C4', 'Wrong routing delays or denies payment to a policyholder; D10 records two near misses'], 18: ['E1', 'D7-ARR01', 'Due diligence response naming the triage tool'], 19: ['Routing outcomes by category, aggregated weekly in the triage platform', 'IV-2 2026-10-15'], 20: ['partly', 'D9 p.2', 'An auditor with access could verify; none appointed'] },
    { locEstablished: 'Australia', locRuns: 'Australia', authorityTests: [{ answer: true, source: 'D7-ARR01 p.3' }, { answer: false, source: 'D5-ARR01 cl.4' }, { answer: false, source: 'D7-ARR01 p.4' }, { answer: false, source: 'D7-ARR01 p.4' }], tierProposed: 'A3', classifiedBy: 'p5', consequenceConfirmedBy: 'p3', consequenceConfirmedOn: '2026-10-17',
      obtainability: { start: 'E4', rungs: { E4: { T1: pass('IV-2'), T2: pass('Aggregate by category'), T3: fail('Audit clause reaches financial records only (cl.11.2)'), T4: pass('D9 p.2'), T5: pass('cl.14.1') }, E3: { T1: fail('No trigger defined'), T2: pass(''), T3: pass('cl.14.1'), T4: pass(''), T5: pass('') }, E2: { T1: pass('D5-ARR01 cl.9 describes quarterly attestation'), T2: pass(''), T3: pass('cl.9 periodic reporting'), T4: pass('D9 p.2'), T5: pass('Quarterly') } } },
      peerReview: { personId: 'p6', tier: 'A3', differs: false, resolution: '', on: '2026-10-18' }, reviewedBy: 'p6' });
  mk('ARR-01', { 3: ['B2', 'D7-ARR01 p.3'], 4: ['platform', 'D7-ARR01 p.3'], 5: ['Motor claims handling · critical operation: Claims payment', 'D3 p.4'], 6: ['partly', 'D1 row 14 names Harlow only'], 7: ['Claim scoring service behind the triage model', 'D7-ARR01 p.3'], 8: ['Quillon Analytics (fictional)', 'D7-ARR01 p.3'], 9: null, 10: ['Australia; model hosting not stated', 'D7-ARR01 p.3'], 11: ['Scores each new claim. The score sets the route the triage model applies.', 'D7-ARR01 p.3'], 12: ['decision', 'IV-2 2026-10-15'], 13: ['none', 'D7-ARR01 p.4'], 14: ['No flow-down term found in D5-ARR01 on sub-contractor AI.', 'D5-ARR01 p.16'] }, { locEstablished: 'Australia', locRuns: '' });
  mk('ARR-02', { 3: ['B3', 'D8-ARR02 p.1'], 4: ['own', 'D2 s.4'], 5: ['Legal research and drafting · none', 'IV-5 2026-10-17'], 6: ['yes', 'D1 row 3'], 7: ['Drafting assistant for legal staff', 'D8-ARR02 p.1'], 8: ['Lexmere Ltd (fictional)', 'D8-ARR02 p.1'], 9: ['Lexmere Ltd (fictional); model provider named in the security pack', 'D8-ARR02 p.6'], 10: ['Lexmere: United Kingdom · processing: Australia region', 'D8-ARR02 p.6'], 11: ['Drafts and summarises documents. A lawyer edits and sends the final text.', 'D2 s.4'], 12: ['acts', 'D2 s.4'], 13: ['none', 'D8-ARR02 p.7'], 14: ['cl.7: usage reports on request. cl.9: 30 days\u2019 notice of a sub-processor change.', 'D8-ARR02 p.3'], 15: ['A1', 'Q5 tests 1 to 3'], 16: ['C2', 'Misuse would breach the licence acceptable-use term'], 18: ['E1', 'D8-ARR02', 'Licence terms and usage policy'], 19: ['Monthly usage report by team', 'D8-ARR02 p.3'], 20: ['yes', 'D8-ARR02 p.3', 'Report can be checked against the insurer\u2019s own logs'] },
    { locEstablished: 'United Kingdom', locRuns: 'Australia', authorityTests: [{ answer: false, source: 'D2 s.4' }, { answer: false, source: 'D2 s.4' }, { answer: false, source: 'D8-ARR02 p.7' }, { answer: false, source: 'D8-ARR02 p.7' }], tierProposed: 'A1', classifiedBy: 'p5', obtainability: { start: 'E1', rungs: { E1: { T1: pass('D8-ARR02 p.3 usage report seen'), T2: pass(''), T3: pass('cl.7'), T4: pass('Own logs'), T5: pass('Monthly') } } }, peerReview: { personId: 'p6', tier: 'A1', differs: false, resolution: '', on: '2026-10-18' }, reviewedBy: 'p6',
      dl3Rows: [{ category: 'Permitted purposes for legal staff use, from D2 s.4', record: 'Usage report by team (cl.7)' }] });
  mk('ARR-03', { 3: ['B1', 'D3 p.6'], 4: ['provider', 'D6-ARR03 p.2'], 5: ['SME property pricing · none', 'D3 p.6'], 6: ['no', 'D1 (not listed)'], 7: null, 8: ['Fenwick Underwriting Pty Ltd (fictional)', 'D6-ARR03 p.1'], 9: null, 10: ['Australia', 'D6-ARR03 p.1'], 11: null, 12: null, 13: null, 14: ['Binder cl.6: Fenwick prices within the rating guide; no term mentions automation.', 'D6-ARR03 p.4'] }, { notDeterminable: { on: true, since: '2026-10-16', question: 'Does Fenwick use an automated pricing model under the binder, and does it set premium without referral?', who: "Fenwick's underwriting manager, through Corvane's delegated authority manager" } });
  X.questions = [
    { ref: 'QC-01', arrangementId: 'ARR-01', entryId: 'REG-001', question7: 7, facts: 'D5-ARR01 cl.11.2 gives an audit right over "financial records relating to the Services". D7-ARR01 p.3 names the triage tool. No term mentions automated decisions.', question: 'Does the audit clause reach an aggregate record of automated triage outcomes? What can the insurer require at renewal?', why: 'Field 25 and test T3 at E4 depend on it', response: '', respondedOn: '', status: 'open', owner: '', sentOn: '2026-10-19', targetField: '25' },
    { ref: 'QC-02', arrangementId: 'ARR-02', entryId: 'REG-003', question7: 7, facts: 'D8-ARR02 cl.7 provides usage reports on request.', question: 'What evidence can the insurer reasonably require of the drafting service at this boundary?', why: 'Field 25', response: 'On the licence terms supplied, disclosure of use (E1) is the reasonable expectation at this boundary.', respondedOn: '2026-10-21', status: 'answered', owner: '', sentOn: '2026-10-19', targetField: '25', enteredBy: 'p1' }];
  X.entries[2].fields[25] = { value: 'E1', detail: 'expectation', source: 'QC-02', notKnown: false, by: 'p1', on: '2026-10-21', locked: true };
  X.history = [{ at: '2026-10-13T09:00:00.000Z', by: 'Sam Okoro', action: 'mobilise', target: 'engagement', from: null, to: 'started' }];
  S = old; return X;
}

/* ---------- events ---------- */
function curEntry() { return S ? ent(UI.entryId) : null; }
function onClick(ev) {
  const pt = ev.target.closest('[data-pact]');
  if (pt) { const a = pt.dataset.pact; if (a === 'close') closePop(); else if (a === 'back') { UI.pop.stack.pop(); renderPop(); } else if (a === 'more') { const id = pt.dataset.id; closePop(true); popAnchor = null; go('reference'); const el = document.getElementById('g-' + id); if (el) { window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 90); el.style.background = 'var(--aubergine-bg)'; } } return; }
  const term = ev.target.closest('.term');
  if (term) { ev.preventDefault(); ev.stopPropagation(); const id = term.dataset.term; if (term.closest('#poproot') && UI.pop) { UI.pop.stack.push(id); renderPop(); } else if (UI.pop && popAnchor === term) closePop(); else openPop(id, term); return; }
  if (UI.pop && !ev.target.closest('#poproot')) closePop(true);
  if (UI.acct && !ev.target.closest('.acct')) { UI.acct = false; if (!ev.target.closest('[data-act]')) { render(); return; } }
  const el = ev.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const a = el.dataset.act, d = el.dataset, e = curEntry(), m = me();
  const gateOf = { addPerson: 'setup', rmPerson: 'setup', addDoc: 'setup', addIv: 'setup', loadCal: 'setup', loadCalApp: 'setup', addArr: 'set', rmArr: 'set', addEntry: 'facts', rmEntry: 'facts', addQ: 'ask', askFrom: 'ask', runR2: 'r2', recR4: 'r4', recR6: 'r6', recR7: 'r7', clearHit: 'r5', addExc: 'tri', addIR: 'irLog', signAnnex: 'sign', acceptHB: 'handBack', agreeGC: 'agreeGC', agreeCounsel: 'agreeCounsel', confirmCons: 'consequence', addDl3: 'tri', answerQ: 'answer', applyDet: 'answer', openOwner: 'answer' }[a];
  if (gateOf) { const why = deny(gateOf, a === 'rmEntry' ? ent(d.id) : null); if (why) return toast(why); }
  const A = {
    go: () => go(d.to), drawer: () => { UI.drawer = !UI.drawer; UI.acct = false; render(); },
    acct: () => { UI.acct = !UI.acct; render(); },
    saveChip: async () => { if (SRV.state === 'conflict') { if (confirm('Someone else changed the same item. Load the latest saved version? Your unsaved change will be lost; you can then make it again.')) { const keep = { screen: UI.screen, entryId: UI.entryId, tab: UI.tab }; await loadReal(); Object.assign(UI, keep); render(); } } else if (SRV.state === 'error') saveNow(); else toast(saveLabel()[2]); },
    loadCal: () => document.getElementById('calIn').click(),
    loadCalApp: async () => { toast('Reading the calibration set from the Risk Appetite app…'); const r = await api('GET', '/api/calibration-from-appetite'); if (!r.ok) return toast(r.code === 'not_linked' ? r.error : 'Could not load: ' + r.error); if (loadCalibration(r.body)) { render(); toast('Calibration loaded: ' + calLabel()); } },
    new: async () => { if (!SRV.on) return toast('The server could not be reached.'); if (!canSetup()) return toast('The method owner or the delivery manager starts the assessment.'); const r = await api('GET', '/api/engagement'); if (r.ok && r.body.exists) { await loadReal(); go('overview'); return toast('The assessment was already started by ' + (r.body.updatedBy || 'someone else') + '.'); }
      S = newAssessment(); S.people = SRV.people || []; applyIdentity(); UI.entryId = null; log('mobilise', 'engagement', null, 'started'); go('setup'); },
    example: () => { if (savesHere() && SRV.state !== 'saved') return toast('Wait until your changes are saved.'); S = buildExample(); UI.personId = 'p5'; UI.entryId = null; UI.dirty = false; go('overview'); toast('Worked example open. Corvane and its providers are fictional. Nothing here is saved.'); },
    leaveExample: async () => { S = null; UI.entryId = null; await loadReal(); UI.screen = 'overview'; render(); },
    addPerson: () => { S.people.push({ id: 'p' + uid(), name: '', organisation: '', roles: [] }); log('addPerson', 'people'); render(); },
    rmPerson: () => { const p = S.people[+d.i]; if (confirm('Remove ' + (p.name || 'this person') + '?')) { S.people.splice(+d.i, 1); if (UI.personId === p.id) UI.personId = ''; log('removePerson', 'people', p.name, null); render(); } },
    addDoc: () => { S.documents.push({ id: 'D' + (S.documents.length + 1), ref: '', title: '', status: '', date: '' }); log('addDocument', 'documents'); render(); },
    addIv: () => { S.interviews.push({ id: 'IV-' + (S.interviews.length + 1), who: '', date: '', notesRef: '' }); log('addInterview', 'interviews'); render(); },
    addArr: () => { let n = S.arrangements.length + 1; while (S.arrangements.some(x => x.id === 'ARR-' + String(n).padStart(2, '0'))) n++; S.arrangements.push({ id: 'ARR-' + String(n).padStart(2, '0'), name: '', parties: '', boundaries: [], criteria: [], reason: '', nextContracting: '', function: '', findingOwner: '' }); log('addArrangement', 'set'); render(); },
    rmArr: () => { const x = S.arrangements[+d.i]; if (S.entries.some(y => y.arrangementId === x.id)) return toast('Remove its register entries first.'); S.arrangements.splice(+d.i, 1); log('removeArrangement', x.id); render(); },
    agreeGC: () => { Object.assign(S.setAgreed, { gcBy: m.id, gcOn: today(), on: today() }); log('R1', 'set', null, 'GC agreed: ' + m.name); render(); },
    agreeCounsel: () => { Object.assign(S.setAgreed, { counselBy: m.id, counselOn: today(), on: today() }); log('R1', 'set', null, 'counsel agreed: ' + m.name); render(); },
    addEntry: () => { const x = newEntry(document.getElementById('newEntryArr').value); S.entries.push(x); log('addEntry', x.id); UI.entryId = x.id; UI.tab = 'facts'; render(); window.scrollTo(0, 0); },
    openEntry: () => { UI.entryId = d.id; UI.tab = 'facts'; if (UI.screen !== 'register') go('register'); else { render(); window.scrollTo(0, 0); } },
    closeEntry: () => { UI.entryId = null; render(); }, tab: () => { UI.tab = d.t; render(); },
    expand: () => { UI.expanded[d.id] = !UI.expanded[d.id]; render(); },
    sheet: () => { UI.sheet = d.s; renderSheet(); const f = document.querySelector('#sheetroot select, #sheetroot input, #sheetroot textarea'); if (f) f.focus(); },
    closeSheet: () => { const s = UI.sheet; UI.sheet = null; renderSheet(); const b = document.getElementById(s === 'filters' ? 'openFilters' : 'openAsk'); if (b) b.focus(); },
    rmEntry: () => { if (confirm('Delete ' + d.id + '?')) { S.entries = S.entries.filter(x => x.id !== d.id); log('deleteEntry', d.id); UI.entryId = null; render(); } },
    hist: () => { UI.hist = UI.hist === d.k ? null : d.k; render(); },
    askFrom: () => { const x = ent(d.id), f = x.fields[d.n] || {}; UI.ask = { arrangementId: x.arrangementId, entryId: x.id, question7: +d.n >= 17 ? 7 : +d.n === 14 ? 3 : +d.n === 10 ? 4 : 2, targetField: +d.n >= 17 ? '25' : +d.n === 14 ? '24' : '23', facts: `Field ${d.n} ${FLD(d.n).name}: ${f.notKnown ? 'not known' : (f.value || '—')}${f.source ? ' (' + f.source + ')' : ''}`, question: '', why: `Field ${d.n} and the fields that depend on it` }; go('counsel'); if (bp() === 'phone') { UI.sheet = 'ask'; renderSheet(); } else { const t = document.getElementById('askForm'); if (t) window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 80); } },
    classifyEntry: () => { if (d.id) UI.entryId = d.id; UI.step = +(d.step || 1); go('classify'); },
    step: () => { UI.step = +d.s; UI.err = {}; render(); },
    setTier: () => { const why = deny('classify', e); if (why) return toast(why); if (!fieldDone(e, 11)) return toast('Field 11 first.'); const v = document.getElementById('tierSel').value, p = proposeTier(e); if (!v) { UI.err.tier = 'Choose a tier.'; return render(); } if (p && v !== p && !String(e.tierOverrideReason || '').trim()) { UI.err.tier = `${v} differs from the proposed ${p}. Write the override reason first.`; return render(); } delete UI.err.tier; e.tierProposed = p || ''; setFieldVal(e, 15, { value: v, source: (e.fields[15] || {}).source || 'Q5 tests 1 to 3' }); e.classifiedBy = UI.personId; if (e.peerReview.tier) e.peerReview.differs = e.peerReview.tier !== v; render(); toast('Field 15 recorded: ' + v); },
    confirmCons: () => { e.consequenceConfirmedBy = UI.personId; e.consequenceConfirmedOn = today(); log('confirmConsequence', e.id, null, fv(e, 16)); render(); },
    setPeer: () => { const why = deny('peer', e); if (why) return toast(why); const v = document.getElementById('peerSel').value; if (!v) { UI.err.peer = 'Choose a tier.'; return render(); } delete UI.err.peer; e.peerReview = { personId: UI.personId, tier: v, differs: !!fv(e, 15) && v !== fv(e, 15), resolution: '', on: today() }; e.reviewedBy = UI.personId; log('peerReview', e.id, null, v); render(); },
    qOpen: () => { UI.qOpen = UI.qOpen === d.r ? null : d.r; render(); },
    addQ: () => { const A = Object.assign({ arrangementId: (S.arrangements[0] || {}).id, question7: 1 }, UI.ask || {}); if (!A.question || !A.question.trim()) return toast('Write the question.'); let n = S.questions.length + 1; while (S.questions.some(q => q.ref === 'QC-' + String(n).padStart(2, '0'))) n++; const ref = 'QC-' + String(n).padStart(2, '0'); S.questions.push({ ref, arrangementId: A.arrangementId, entryId: A.entryId || '', question7: +A.question7, facts: A.facts || '', question: A.question.trim(), why: A.why || '', response: '', respondedOn: '', status: 'open', owner: '', sentOn: today(), targetField: A.targetField || '' }); UI.ask = null; UI.qOpen = ref; UI.sheet = null; log('question', ref, null, 'raised'); render(); toast(ref + ' added.'); },
    answerQ: () => { const i = +d.i, q = S.questions[i], base = 'q-' + sid(q.ref), t = document.getElementById(base + '-resp').value.trim(); if (!t) { UI.err['q' + i] = 'Enter the response.'; return render(); }
      if (!has('counsel')) { const vb = document.getElementById(base + '-verb'); if (!vb || !vb.checked) { UI.err['q' + i] = 'A transcription must be pasted verbatim. Tick the confirmation.'; return render(); } q.transcribedBy = UI.personId; } else q.enteredBy = UI.personId;
      const dq = document.getElementById(base + '-detq'), rc = document.getElementById(base + '-reach'); q.determination = dq ? dq.value : ''; q.reach = rc ? rc.value : '';
      delete UI.err['q' + i]; q.response = t; q.respondedOn = today(); q.status = 'answered'; log('answer', q.ref, 'open', has('counsel') ? 'answered by counsel' : 'transcribed'); render(); },
    openOwner: () => { const i = +d.i, q = S.questions[i], o = document.getElementById('q-' + sid(q.ref) + '-own').value; if (!o) return toast('Choose an owner.'); q.status = 'openWithOwner'; q.owner = o; log('openWithOwner', q.ref, null, pname(o)); render(); },
    applyDet: () => { const q = S.questions[+d.i], x = ent(q.entryId), tf = String(q.targetField || ''), base = 'q-' + sid(q.ref); if (!x) return toast('This question points to an entry that does not exist.'); if (q.status !== 'answered') return toast('Only an answered question can fill fields 23 to 25.'); const nw = newestFor(q); if (nw && nw !== q) return toast(`Blocked: ${nw.ref} is the newest answered question for ${x.id} field ${tf}.`);
      const v = tf === '23' ? q.response : document.getElementById(base + '-det').value, det = tf === '25' ? document.getElementById(base + '-grade').value : '';
      x.fields[tf] = { value: v, detail: det, source: q.ref, notKnown: false, by: UI.personId, on: today(), locked: true, transcribedBy: has('counsel') ? '' : UI.personId };
      log('determination', x.id, null, `field ${tf} from ${q.ref}`); render(); toast(`Field ${tf} recorded from ${q.ref}.`); },
    runR2: () => { const bad = S.entries.filter(x => ![3,4,5,6,7,8,9,10,11,12,13,14].every(n => fieldDone(x, n))); Object.assign(rev('R2'), { by: UI.personId, on: today(), result: bad.length ? 'failed' : 'passed', notes: bad.length ? 'Incomplete: ' + bad.map(x => x.id).join(', ') : 'Every value sourced or not known' }); log('R2', 'review', null, rev('R2').result); render(); },
    recR4: () => { Object.assign(rev('R4'), { by: UI.personId, on: today(), result: d.r, notes: d.r === 'exceptions' ? 'See exceptions log' : 'Rules 8.3 and 8.4 applied consistently across entries' }); log('R4', 'review', null, d.r); render(); },
    recR6: () => { Object.assign(rev('R6'), { by: UI.personId, on: today(), result: 'recorded', notes: 'Draft seen by counsel first; determinations transcribed accurately' }); log('R6', 'review', null, 'recorded'); render(); },
    recR7: () => { if (S.independentReviewPoints.some(p => p.status === 'open')) return toast('Close or disclose every review point first.'); const line = S.engagement.independentReviewerReportsTo; Object.assign(rev('R7'), { by: UI.personId, on: today(), result: 'complete', notes: line === 'cro' ? 'Confirmed by the CRO' : 'Confirmed by the independent reviewer, through counsel' }); log('R7', 'review', null, 'complete'); render(); },
    clearHit: () => { S.r5Cleared[d.k] = { by: UI.personId, on: today() }; log('R5 clear', 'R5', null, d.k.split('|')[0]); render(); },
    addExc: () => { S.exceptions.push({ ref: 'EX-' + String(S.exceptions.length + 1).padStart(2, '0'), departure: '', reason: '', approvedBy: '', on: today() }); log('addException', 'exceptions'); render(); },
    addIR: () => { S.independentReviewPoints.push({ ref: 'IR-' + String(S.independentReviewPoints.length + 1).padStart(2, '0'), output: '', section: '', point: '', response: '', status: 'open' }); log('addReviewPoint', 'IR'); render(); },
    addDl3: () => { const x = ent(d.id); x.dl3Rows = x.dl3Rows || []; x.dl3Rows.push({ category: '', record: '' }); log('addDl3', x.id); render(); },
    outTab: () => { UI.outTab = d.t; if (UI.screen !== 'outputs') go('outputs'); else render(); },
    copyOut: () => copyText(outText(O(UI.outTab))),
    dlOut: () => { const o = O(UI.outTab); if (d.m === 'final') { const why = finalWhy(o); if (why) return toast('Final export blocked: ' + why); } download(`AUA-${slug(S.engagement.insurer)}-${o.id}-${d.m}.md`, withMode(d.m, () => o.gen()), 'text/markdown'); },
    dlCsv: () => download(`AUA-${slug(S.engagement.insurer)}-DL1-register.csv`, dl1Csv(), 'text/csv'),
    dlExtract: () => download(`AUA-${slug(S.engagement.insurer)}-register-extract.json`, JSON.stringify(registerExtract(), null, 2), 'application/json'), cpExtract: () => copyText(JSON.stringify(registerExtract(), null, 2)),
    signAnnex: () => { S.engagement.annexSigned = { by: UI.personId, on: today() }; log('signAnnex', 'DL5', null, pname(UI.personId)); render(); },
    acceptHB: () => { S.engagement.handBack = { by: UI.personId, on: today() }; log('handBack', 'DL6', null, 'accepted'); render(); }
  };
  if (A[a]) A[a]();
}
function onChange(ev) { inChange = true; try { changeHandler(ev); } finally { inChange = false; } }
function changeHandler(ev) {
  const t = ev.target, d = t.dataset, e = curEntry(); if (t.id) UI.lastCtl = t.id;
  if (t.id === 'calIn') { if (t.files[0]) readJson(t.files[0], o => { if (loadCalibration(o)) { render(); toast('Calibration loaded: ' + calLabel()); } }); t.value = ''; return; }
  if (d.act === 'person') { if (!practice() && SRV.user) return render(); UI.personId = t.value; UI.err = {}; render(); return; }
  if (d.act === 'tab') { UI.tab = t.value; render(); return; }
  if (d.act === 'pickEntry') { UI.entryId = t.value; render(); return; }
  if (d.filt) { UI.filt[d.filt] = t.type === 'checkbox' ? t.checked : t.value; render(); return; }
  if (d.ask) { UI.ask = UI.ask || {}; UI.ask[d.ask] = t.value; if (d.ask === 'arrangementId') UI.ask.entryId = ''; render(); return; }
  const fact = d.fv || d.fd || d.fs || d.fnk, cls = d.at != null || d.ats != null || d.cons || d.ob || d.obs;
  if (fact && e) { const why = deny('facts', e); if (why) { toast(why); return render(); } }
  if (cls && e) { const why = deny('classify', e); if (why) { toast(why); return render(); } }
  if (d.fv && e) { const n = +d.fv; if (n >= 23) return; setFieldVal(e, n, { value: t.value }); render(); return; }
  if (d.fd && e) { setFieldVal(e, +d.fd, { detail: t.value }); render(); return; }
  if (d.fs && e) { setFieldVal(e, +d.fs, { source: t.value.trim() }); render(); return; }
  if (d.fnk && e) { setFieldVal(e, +d.fnk, { notKnown: t.checked }); render(); return; }
  if (d.at != null && e) { const k = +d.at; e.authorityTests[k].answer = t.value === '' ? null : (t.value === 'yes' || t.value === 'without'); log('authorityTest ' + (k + 1), e.id, null, t.value); render(); return; }
  if (d.ats != null && e) { e.authorityTests[+d.ats].source = t.value; log('authoritySource', e.id, null, t.value); render(); return; }
  if (d.cons && e) { setFieldVal(e, 16, { value: d.cons }); e.consequenceConfirmedBy = ''; render(); return; }
  if (d.ob && e) { const [r, k] = d.ob.split('|'); const R = e.obtainability.rungs; R[r] = R[r] || {}; R[r][k] = Object.assign(R[r][k] || {}, { pass: t.value === '' ? null : t.value === 'pass' }); if (r === ladder(e)[0]) e.obtainability.start = r; else if (!e.obtainability.start) e.obtainability.start = ladder(e)[0]; log('test ' + r + ' ' + k, e.id, null, t.value || null); render(); return; }
  if (d.obs && e) { const [r, k] = d.obs.split('|'); const R = e.obtainability.rungs; R[r] = R[r] || {}; R[r][k] = Object.assign(R[r][k] || { pass: null }, { source: t.value }); log('testSource ' + r + ' ' + k, e.id, null, t.value); render(); return; }
  if (d.arrchk) { const pt = pathTarget(d.arrchk), why = deny(pt[0], pt[1]); if (why) { toast(why); return render(); } const ks = d.arrchk.split('.'); if (ks[2] === 'dl4Triggers') { const a = S.arrangements[+ks[1]]; if (!Array.isArray(a.dl4Triggers)) a.dl4Triggers = (P('P10') || []).map(t => t.ref); } let o = S; ks.forEach(k => o = o[k]); const v = t.value, i = o.indexOf(v); if (t.checked && i < 0) o.push(v); if (!t.checked && i >= 0) o.splice(i, 1); log('edit', d.arrchk, null, o.join(',')); render(); return; }
  if (d.path) { setPath(d.path, t.type === 'checkbox' ? t.checked : t.value); render(); return; }
}
function onInput(ev) {
  const t = ev.target;
  if (t.dataset.act === 'refq') { UI.refQ = t.value; render(); return; }
  if (t.dataset.ask) { UI.ask = UI.ask || {}; UI.ask[t.dataset.ask] = t.value; return; }
  if (t.dataset.path || t.dataset.fv || t.dataset.fs || t.dataset.fd) UI.dirty = true; /* state is written on change, so history keeps the true "from" */
}
function onKey(ev) {
  const t = ev.target, typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName);
  if (ev.key === 'Escape' && UI.acct) { UI.acct = false; render(); return; }
  if (ev.key === 'Escape') { if (UI.pop) { closePop(); return; } if (UI.sheet) { UI.sheet = null; renderSheet(); return; } if (UI.drawer) { UI.drawer = false; render(); return; } }
}
function boot() {
  C = window.AUA_CONTENT;
  if (!C) { document.getElementById('app').innerHTML = '<p style="padding:40px">aua-content.js could not be loaded.</p>'; return; }
  C.glossary.rule11 = { term: 'Field 11 before field 15', def: 'The description is written before the tier is chosen, so a reviewer can re-derive the tier from it. Field 11 must be saved with a source, or recorded as not known, first.', where: 'Classify' };
  const tt = document.getElementById('toast'); if (tt) { tt.className = 'vh'; tt.setAttribute('role', 'status'); tt.setAttribute('aria-live', 'polite'); }
  document.addEventListener('click', onClick); document.addEventListener('change', onChange); document.addEventListener('input', onInput); document.addEventListener('keydown', onKey);
  let sy0 = null; document.addEventListener('touchstart', e => { if (e.target.closest('.handle')) sy0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchmove', e => { if (sy0 != null && e.touches[0].clientY - sy0 > 60) { sy0 = null; if (UI.pop) closePop(); } }, { passive: true });
  window.addEventListener('resize', () => { if (bp() !== lastBp) { closePop(true); popAnchor = null; render(); } });
  window.addEventListener('popstate', ev => { const s = (ev.state && ev.state.screen) || location.hash.slice(1); if (S && s && SNAME[s]) go(s, true); });
  window.addEventListener('beforeunload', e => { if ((savesHere() && SRV.state !== 'saved') && !LEAVING) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshIfQuiet(); else if (savesHere() && SRV.timer) saveNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') refreshIfQuiet(); }, 30000);
  render();
  connect();
}
async function connect() {
  const r = await api('GET', '/api/me');
  SRV.checked = true;
  if (r.ok) { SRV.on = true; SRV.user = r.body.user; SRV.site = r.body.site || ''; await loadReal(); if (S) { const h = location.hash.slice(1); UI.screen = h && SNAME[h] ? h : 'overview'; } }
  else { SRV.on = false; SRV.code = r.code || ''; SRV.reason = r.error; }
  render();
}
window.AUA = { get state() { return S; }, go, gates: () => gates(), finding: id => finding(arr(id)), extract: () => registerExtract(), validate: o => validateFile(o), validateCal: o => validateCalibration(o), broken: () => brokenRefs(), hits: () => legalHits(), hydrate: o => hydrate(o), setState: x => { S = x; REV++; render(); }, save: () => snapshotForSave(), loadCalibration: (o, c) => { const r = loadCalibration(o, c); render(); return r; } };
boot();
})();
