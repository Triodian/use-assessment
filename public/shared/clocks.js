// Notification clocks, by jurisdiction and sector (AI Incident Accountability, Shape A; development plan task A.6).
// Each clock is a period an instrument allows for notifying a regulator or another party after a defined moment, such
// as becoming aware of an incident. The app shows which clocks would run for an engagement and, given the moment the
// entity became aware, when each would end. It starts no clock of its own and decides nothing: every line is marked
// "per the Atlas as at [date], confirm with counsel", and counsel confirms before any notification is sent (scoping
// note, risk 5). A clock with an `atlas` record is read from the AI Obligations Atlas dataset of ATLAS_AS_AT (the
// record's statement and its lastVerified date); a clock without one is Triodian's reading of the instrument as at
// READING_AS_AT and is marked so, until the Atlas carries the record. Plain functions, no page code: the tests run it
// in Node, and the page loads it as a module (public/index.html).

export const FORMAT = 'triodian.clocks.v1';
/** The Atlas dataset the Atlas-backed clocks were read from (its generatedAt date and ledger head). */
export const ATLAS_AS_AT = '2026-11-15';
export const ATLAS_LEDGER = 'ledger sequence 1184';
/** The date of Triodian's reading for clocks the Atlas does not yet carry. */
export const READING_AS_AT = '2026-11-16';
export const CONFIRM = 'confirm with counsel';

/* Sector tags a clock applies to. 'any' applies to every pack of the jurisdiction; the others name pack ids or the
   groups below. A clock's `sectors` lists tags; an engagement matches when its pack id, its pack's group or 'any' is
   among them. */
const GROUPS = {
  apra: ['generalInsurer', 'superTrustee', 'adi'],                       // APRA-regulated entities (CPS 230, CPS 234)
  usFinancial: ['usBanking', 'usInsurance', 'usSecurities'],
};

/** The clocks. hours or days or businessDays: the period. from: the moment it runs from. to: who is notified. */
export const CLOCKS = [
  // ---- Australia ----
  { id: 'AU-CPS230-33', jurisdiction: 'AU', sectors: ['apra'], instrument: 'CPS 230', where: 'para 33', to: 'APRA',
    what: 'An operational risk incident likely to have a material financial impact or a material impact on the ability to maintain critical operations',
    from: 'becoming aware of the incident', hours: 72, atlas: 'OBL-AU-CPS230-33@1', verified: '2026-10-27' },
  { id: 'AU-CPS230-42', jurisdiction: 'AU', sectors: ['apra'], instrument: 'CPS 230', where: 'para 42', to: 'APRA',
    what: 'A disruption to a critical operation outside tolerance', from: 'the disruption', hours: 24, atlas: 'OBL-AU-CPS230-35@1', verified: '2026-10-27' },
  { id: 'AU-CPS230-59', jurisdiction: 'AU', sectors: ['apra'], instrument: 'CPS 230', where: 'para 59(a)', to: 'APRA',
    what: 'Entering into or materially changing an agreement for a service relied on for a critical operation', from: 'the agreement or the change', businessDays: 20, atlas: 'OBL-AU-CPS230-54@1', verified: '2026-10-27',
    note: 'A change clock, not an incident clock: a vendor change on shared infrastructure can be a material change to the agreement' },
  { id: 'AU-CPS234-35', jurisdiction: 'AU', sectors: ['apra'], instrument: 'CPS 234', where: 'para 35', to: 'APRA',
    what: 'A material information security incident', from: 'becoming aware of the incident', hours: 72, atlas: 'OBL-AU-CPS234-27@1', verified: '2026-10-27' },
  { id: 'AU-CPS234-36', jurisdiction: 'AU', sectors: ['apra'], instrument: 'CPS 234', where: 'para 36', to: 'APRA',
    what: 'A material information security control weakness', from: 'becoming aware of the weakness', businessDays: 10, atlas: 'OBL-AU-CPS234-27@1', verified: '2026-10-27' },
  { id: 'AU-SOCI-30BC', jurisdiction: 'AU', sectors: ['bpCiCorporate', 'bpCiGovernment'], instrument: 'Security of Critical Infrastructure Act 2018 (Cth)', where: 's 30BC', to: 'The Australian Signals Directorate',
    what: 'A critical cyber security incident affecting a critical infrastructure asset', from: 'becoming aware of the incident', hours: 12, atlas: 'OBL-AU-SOCI-30BC@1', verified: '2026-11-08' },
  { id: 'AU-SOCI-30BD', jurisdiction: 'AU', sectors: ['bpCiCorporate', 'bpCiGovernment'], instrument: 'Security of Critical Infrastructure Act 2018 (Cth)', where: 's 30BD', to: 'The Australian Signals Directorate',
    what: 'Any other cyber security incident with a relevant impact on a critical infrastructure asset', from: 'becoming aware of the incident', hours: 72, atlas: 'OBL-AU-SOCI-30BC@1', verified: '2026-11-08' },
  { id: 'AU-CSA-27', jurisdiction: 'AU', sectors: ['any'], instrument: 'Cyber Security Act 2024 (Cth)', where: 's 27', to: 'The designated Commonwealth body',
    what: 'A ransomware payment by a reporting business entity', from: 'making the payment, or becoming aware it was made', hours: 72, atlas: 'OBL-AU-CSA-27@1', verified: '2026-11-08' },
  { id: 'AU-NDB-26WH', jurisdiction: 'AU', sectors: ['any'], instrument: 'Privacy Act 1988 (Cth), Part IIIC', where: 'ss 26WH and 26WK', to: 'The OAIC and the affected individuals',
    what: 'A suspected eligible data breach: the assessment period; notification follows as soon as practicable once the entity is satisfied', from: 'becoming aware of reasonable grounds to suspect', days: 30, atlas: null },
  // ---- Singapore ----
  { id: 'SG-MAS-TRM', jurisdiction: 'SG', sectors: ['masFi'], instrument: 'MAS Notice on Technology Risk Management', where: 'the Notice (Notices 644, 655 and the equivalents by licence)', to: 'MAS',
    what: 'A relevant incident: a system malfunction or IT security incident with a severe and widespread impact on operations or customers', from: 'discovery of the incident', hours: 1, atlas: null,
    note: 'A root cause and impact analysis follows within 14 days' },
  { id: 'SG-PDPA-26D', jurisdiction: 'SG', sectors: ['any'], instrument: 'Personal Data Protection Act 2012', where: 's 26D(1)', to: 'The PDPC, then the affected individuals',
    what: 'A notifiable data breach', from: 'the day the organisation assesses the breach to be notifiable', days: 3, atlas: 'OBL-SG-PDPA-26D@1', verified: '2026-11-08' },
  // ---- United States ----
  { id: 'US-BANK-36H', jurisdiction: 'US', sectors: ['usBanking'], instrument: 'Computer-Security Incident Notification Rule (12 CFR parts 53, 225 and 304)', where: 'the rule', to: 'The primary federal regulator',
    what: 'A notification incident at a banking organization', from: 'determining that a notification incident has occurred', hours: 36, atlas: null,
    note: 'A bank service provider notifies the bank as soon as possible after determining a disruption of four hours or more' },
  { id: 'US-REGSP-248-30', jurisdiction: 'US', sectors: ['usSecurities'], instrument: 'Regulation S-P', where: 'Rule 248.30(a)(5)', to: 'The covered institution (by its service provider); then the affected individuals within 30 days',
    what: 'A breach affecting a customer information system the service provider maintains', from: 'the service provider becoming aware of the breach', hours: 72, atlas: 'OBL-US-REGSP-248-30@1', verified: '2026-11-14' },
  { id: 'US-HIPAA-164-404', jurisdiction: 'US', sectors: ['usHealth'], instrument: 'HIPAA Breach Notification Rule (45 CFR 164.404 to 164.410)', where: '164.404, 164.408 and 164.410', to: 'The affected individuals; HHS; a business associate to the covered entity',
    what: 'A breach of unsecured protected health information', from: 'discovery of the breach', days: 60, atlas: null },
  { id: 'US-CIRCIA-681B-72', jurisdiction: 'US', sectors: ['usCriticalInfrastructure'], instrument: 'CIRCIA (6 U.S.C. 681b)', where: '681b(a)(1)(A)', to: 'CISA',
    what: 'A covered cyber incident at a covered entity', from: 'reasonably believing the incident occurred', hours: 72, atlas: 'OBL-US-CIRCIA-681B@1', verified: '2026-11-14',
    note: 'Takes effect on the dates the final rule prescribes' },
  { id: 'US-CIRCIA-681B-24', jurisdiction: 'US', sectors: ['usCriticalInfrastructure'], instrument: 'CIRCIA (6 U.S.C. 681b)', where: '681b(a)(2)(A)', to: 'CISA',
    what: 'A ransom payment', from: 'making the payment', hours: 24, atlas: 'OBL-US-CIRCIA-681B@1', verified: '2026-11-14', note: 'Takes effect on the dates the final rule prescribes' },
  { id: 'US-NY-500-17', jurisdiction: 'US', sectors: ['usFinancial'], instrument: '23 NYCRR 500 (New York)', where: '500.17(a)', to: 'The NYDFS superintendent',
    what: 'A cybersecurity incident at a New York covered entity', from: 'determining that the incident occurred', hours: 72, atlas: null, note: 'New York covered entities only' },
  // ---- European Union (no pack yet; listed so an EU pack finds its clocks) ----
  { id: 'EU-DORA-19-INITIAL', jurisdiction: 'EU', sectors: ['any'], instrument: 'DORA (Regulation (EU) 2022/2554)', where: 'Article 19 and the reporting RTS', to: 'The competent authority',
    what: 'A major ICT-related incident: the initial notification', from: 'classifying the incident as major (and within 24 hours of becoming aware)', hours: 4, atlas: null },
  { id: 'EU-DORA-19-INTERMEDIATE', jurisdiction: 'EU', sectors: ['any'], instrument: 'DORA (Regulation (EU) 2022/2554)', where: 'Article 19 and the reporting RTS', to: 'The competent authority',
    what: 'A major ICT-related incident: the intermediate report', from: 'the initial notification', hours: 72, atlas: null },
  { id: 'EU-DORA-19-FINAL', jurisdiction: 'EU', sectors: ['any'], instrument: 'DORA (Regulation (EU) 2022/2554)', where: 'Article 19 and the reporting RTS', to: 'The competent authority',
    what: 'A major ICT-related incident: the final report', from: 'the intermediate report', days: 30, atlas: null },
  { id: 'EU-AIA-73', jurisdiction: 'EU', sectors: ['any'], instrument: 'EU AI Act (Regulation (EU) 2024/1689)', where: 'Article 73 (providers) and Article 26(5) (deployers)', to: 'The market surveillance authority (by the provider); the provider (by the deployer, without undue delay)',
    what: 'A serious incident involving a high-risk AI system', from: 'the provider becoming aware of the incident', days: 15, atlas: null,
    note: 'Shorter periods apply to a widespread infringement (2 days) and a death (10 days); the deployer informs the provider without undue delay' },
];

const groupOf = pack => Object.keys(GROUPS).find(g => GROUPS[g].includes(pack)) || null;
/** The clocks for an engagement: its pack's jurisdiction ('AU', 'SG', 'US', 'EU'; 'any' for a best-practice baseline) and pack id. */
export function clocksFor(jurisdiction, pack) {
  if (!jurisdiction || jurisdiction === 'any') return [];
  const g = groupOf(pack);
  return CLOCKS.filter(c => c.jurisdiction === jurisdiction && c.sectors.some(s => s === 'any' || s === pack || s === g));
}
/** "72 hours", "10 business days", "30 days". */
export const period = c => c.hours != null ? `${c.hours} hour${c.hours === 1 ? '' : 's'}` : c.businessDays != null ? `${c.businessDays} business days` : `${c.days} day${c.days === 1 ? '' : 's'}`;
/** The line every clock carries: where it was read from, as at when, and that counsel confirms it. */
export const basisLine = c => c.atlas ? `per the Atlas as at ${ATLAS_AS_AT} (${c.atlas}, verified ${c.verified}), ${CONFIRM}` : `not yet in the Atlas; Triodian's reading of the instrument as at ${READING_AS_AT}, ${CONFIRM}`;

const pad = n => String(n).padStart(2, '0');
const hasZone = s => /(Z|[+-]\d{2}:?\d{2})$/.test(String(s || ''));
const local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** When a clock would end, from the moment it runs from. A time without a zone (as a datetime-local control gives it,
 *  2026-11-14T09:00) is the entity's local time and comes back in the same form; a time with a zone comes back as ISO
 *  UTC. Business days count Monday to Friday and are approximate: the entity's own calendar and the regulator's rules
 *  decide. Returns '' when the start is not a time. */
export function endsAt(c, start) {
  const t = Date.parse(start || ''); if (isNaN(t)) return '';
  const d = new Date(t);
  if (c.hours != null) d.setTime(t + c.hours * 3600000);
  else if (c.days != null) d.setTime(t + c.days * 86400000);
  else if (c.businessDays != null) { let n = c.businessDays; while (n > 0) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n--; } }
  else return '';
  return hasZone(start) ? d.toISOString() : local(d);
}
/** A time for a document: "2026-11-14 09:00" for a local time, "2026-11-14 23:00 UTC" for one with a zone. */
export const stamp = s => { const d = new Date(s || ''); if (isNaN(d)) return ''; return hasZone(s) ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` : local(d).replace('T', ' '); };

/** The clock table for an output or a screen, as rows: [instrument and where, what, to, period, from, basis]. */
export function rows(jurisdiction, pack) {
  return clocksFor(jurisdiction, pack).map(c => [`${c.instrument}, ${c.where}`, c.what + (c.note ? ` (${c.note})` : ''), c.to, period(c), c.from, basisLine(c)]);
}
