// Versions of the assessment, kept at each sign-off so later changes can be compared and redlined.
// The server adds them (lib/core/rbac.js); a browser cannot add, change or remove one.
// public/aua.js has the same two functions for the worked example, which is never saved.

/** What a version keeps: each entry's field values as shown, each arrangement's finding, and the arrangement names. */
export function snapshotOf(d) {
  const entries = {};
  (d.entries || []).forEach(e => {
    const f = {};
    Object.entries(e.fields || {}).forEach(([n, x]) => {
      if (!x) return;
      const v = x.notKnown ? 'not known' : String(x.value == null ? '' : x.value) + (x.detail ? ' · ' + x.detail : '');
      if (v) f[n] = v;
    });
    if (e.expectedRung && e.expectedRung.value) f[17] = e.expectedRung.value;
    if (e.confidence) f[22] = e.confidence;
    entries[e.id] = { arr: e.arrangementId || '', f };
  });
  const findings = {}, arrangements = {};
  (d.findings || []).forEach(x => { if (x && x.arrangementId) findings[x.arrangementId] = x.type || x.label || ''; });
  (d.arrangements || []).forEach(a => { if (a && a.id) arrangements[a.id] = a.name || ''; });
  return { entries, findings, arrangements };
}

/** The sign-offs this save records: each one starts a new version. */
export function signOffs(o, n) {
  const rev = (d, p) => ((d && d.reviews) || []).find(r => r && r.point === p) || {};
  const eng = d => (d && d.engagement) || {};
  const out = [];
  const sa = d => ((d && d.setAgreed) || {});
  if (sa(n).gcBy && sa(n).counselBy && !(sa(o).gcBy && sa(o).counselBy)) out.push('Set agreed (R1)');
  if (rev(n, 'R6').on && !rev(o, 'R6').on) out.push('Counsel review recorded (R6)');
  if (rev(n, 'R7').result === 'complete' && rev(o, 'R7').result !== 'complete') out.push('Independent check complete (R7)');
  if ((eng(n).annexSigned || {}).by && !(eng(o).annexSigned || {}).by) out.push('Technical annex signed');
  if ((eng(n).handBack || {}).by && !(eng(o).handBack || {}).by) out.push('Hand-back list accepted');
  return out;
}

/** Appends a version for each sign-off in this save. Keeps the stored versions; ignores any sent by the browser. */
export function withVersions(oldData, data, by, now) {
  const versions = ((oldData && oldData.versions) || []).slice();
  const labels = signOffs(oldData, data);
  if (labels.length) {
    const snap = snapshotOf(data);
    labels.forEach(label => versions.push({ id: 'V' + (versions.length + 1), label, at: now, by, snapshot: snap }));
  }
  data.versions = versions;
  return labels.length > 0;
}
