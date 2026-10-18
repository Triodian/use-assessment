// The annual assessment: keep the closed assessment as a read-only record and start the next one from it.
// Same design as the AI Risk Appetite app's annual review. Cloud-neutral.

const dLong = ymd => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : (ymd || ''); };
const rev = (d, p) => ((d && d.reviews) || []).find(r => r && r.point === p) || {};

/** Closed: the independent check (R7) is complete and the hand-back list is accepted. */
export function isClosed(data) {
  return rev(data, 'R7').result === 'complete' && !!(((data && data.engagement) || {}).handBack || {}).by;
}

export const archiveLabel = data => {
  const e = data.engagement || {}, hb = e.handBack || {};
  return `${e.insurer || 'Assessment'}${e.reference ? ' · ' + e.reference : ''} · closed ${dLong(hb.on || rev(data, 'R7').on)}`.trim();
};

/** A new assessment for the next year. Set-up, people, the set and each entry's facts (fields 1 to 14, with
 *  their sources) carry over as the starting point. Classification, evidence, questions, reviews, sign-offs,
 *  versions and history start empty. */
export function nextAssessment(data, newId, actor, now, label) {
  const n = JSON.parse(JSON.stringify(data));
  const e = n.engagement || {};
  n.engagement = { ...e, id: newId, startDate: '', briefConfirmed: { by: '', on: '', ref: '' }, documentsRequestedOn: '',
    annexText: {}, annexSigned: { by: '', on: '' }, handBack: { by: '', on: '' }, example: false, autosave: false };
  n.setAgreed = { gcBy: '', gcOn: '', counselBy: '', counselOn: '', on: '' };
  n.documents = (n.documents || []).map(d => ({ ...d, status: '', date: '' }));
  n.interviews = [];
  n.entries = (n.entries || []).map(x => {
    const fields = {};
    Object.entries(x.fields || {}).forEach(([k, f]) => { if (+k <= 14 && f) fields[k] = { ...f, carried: true }; });
    const out = { ...x, fields, authorityTests: (x.authorityTests || []).map(() => ({ answer: null, source: '' })), tierProposed: '', tierOverrideReason: '',
      classifiedBy: '', reviewedBy: '', consequenceConfirmedBy: '', consequenceConfirmedOn: '', obtainability: { start: '', rungs: {} }, confChosen: '', confRaiseReason: '',
      peerReview: { personId: '', tier: '', differs: false, resolution: '', on: '' }, notDeterminable: { on: false, question: '', who: '', since: '' }, dl3Rows: [] };
    delete out.expectedRung; delete out.flags; delete out.confidence;
    return out;
  });
  n.arrangements = (n.arrangements || []).map(a => ({ ...a, findingOwner: '', dl4Triggers: undefined }));
  n.questions = []; n.reviews = []; n.r5Cleared = {}; n.findings = []; n.exceptions = []; n.independentReviewPoints = []; n.diffReports = []; n.versions = [];
  n.previous = { label, closedOn: ((e.handBack || {}).on) || '' };
  n.history = [{ at: now, by: actor, action: 'nextAssessment', target: 'assessment', from: label, to: 'new assessment' }];
  return n;
}
