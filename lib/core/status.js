// Where the engagement stands, for the practitioner's practice hub (development plan task 4.1). Cloud-neutral.
// The hub reads it over a service binding (src/status-service.js) and shows it beside the practitioner's other clients.
// It says where the work is and who it waits on, by role and count: no names, no arrangements or providers, no
// classifications or findings, no questions' wording. Format triodian.status.v1 (see Triodian/practice-hub README).
// The stage follows the recorded sign-offs of the eight gates; the screens check each gate in full.

export const STATUS_FORMAT = 'triodian.status.v1';
const ymd = v => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null);
const filled = v => !!String(v || '').trim();

/** e: the stored engagement ({ data, updatedAt }) or null. today: 'YYYY-MM-DD'. now: an ISO timestamp. */
export function engagementStatus(e, { today, now } = {}) {
  today = today || new Date().toISOString().slice(0, 10);
  const base = { format: STATUS_FORMAT, app: 'use-assessment', generated: now || new Date().toISOString() };
  const GATES = 8;
  if (!e || !e.data) return { ...base, stage: { label: 'Not started', step: 0, steps: GATES }, openActions: 0, waitingOn: [], nextSignOff: null, nextBoardDate: null, lastActivity: null };
  const d = e.data, en = d.engagement || {}, set = d.setAgreed || {}, entries = d.entries || [], qs = d.questions || [];
  const rev = id => (d.reviews || []).find(r => r && r.point === id) || {};
  const counselSide = en.gcActsAsCounsel ? 'Second approver' : 'Counsel';

  // [stage label, met, the sign-off that meets it]
  const gates = [
    ['Set-up', !!((en.briefConfirmed || {}).by && (en.briefConfirmed || {}).on) && filled(en.privilegeMarking) && !!en.documentsRequestedOn, 'The GC confirms the brief'],
    ['The representative set (R1)', !!(set.gcBy && set.counselBy), `The GC and ${counselSide.toLowerCase()} agree the set (R1)`],
    ['The register (R2)', entries.length > 0 && rev('R2').result === 'passed', 'The register completeness check (R2)'],
    ['Classification (R4)', rev('R4').result === 'passed', 'Validation (R4)'],
    ['Counsel', qs.every(q => q.status === 'answered' || (q.status === 'openWithOwner' && q.owner)), 'Counsel answers the open questions'],
    ['Findings and counsel review (R6)', !!rev('R6').on, 'Counsel review (R6)'],
    ['The independent review (R7)', rev('R7').result === 'complete', 'The independent review (R7)'],
    ['Hand-back', !!(en.handBack || {}).by, 'The business accepts the hand-back list'],
  ];
  const next = gates.findIndex(g => !g[1]);
  const stage = next < 0 ? { label: 'Complete: hand-back accepted', step: GATES, steps: GATES } : { label: gates[next][0], step: next + 1, steps: GATES };

  // Who it waits on, by role: the sign-offs, questions and review points still open.
  const wait = new Map(), add = (role, n = 1) => { if (n > 0) wait.set(role, (wait.get(role) || 0) + n); };
  if ((d.arrangements || []).length) { if (!set.gcBy) add('GC'); if (!set.counselBy) add(counselSide); }
  add('Counsel', qs.filter(q => q.status !== 'answered').length);
  add('Business owners', entries.filter(x => { const f = (x.fields || {})[16]; return f && !f.notKnown && filled(f.value) && !x.consequenceConfirmedBy; }).length);
  const points = (d.independentReviewPoints || []).filter(x => x.status === 'open');
  add('Triodian', points.filter(x => !filled(x.response)).length);
  add('Independent reviewer', points.filter(x => filled(x.response)).length);
  if (rev('R6').on && !(en.annexSigned || {}).by) add('Method owner');
  if (rev('R6').on && !(en.handBack || {}).by) add('Business owners');
  const waitingOn = [...wait].map(([role, actions]) => ({ role, actions }));

  return { ...base, stage, openActions: waitingOn.reduce((n, w) => n + w.actions, 0), waitingOn,
    nextSignOff: next < 0 ? null : { label: gates[next][2], due: null }, nextBoardDate: null, lastActivity: ymd(e.updatedAt) };
}
