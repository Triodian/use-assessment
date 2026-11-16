// Notification clocks (AI Incident Accountability, Shape A; development plan task A.6, with US.8's clocks): which clocks an
// engagement's jurisdiction and pack bring, the caveat every line carries, and when a clock ends from the moment it
// runs. Run: node tests/clocks.test.mjs
import { CLOCKS, clocksFor, period, basisLine, endsAt, stamp, rows, ATLAS_AS_AT, READING_AS_AT } from '../public/shared/clocks.js';

let fails = 0; const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
const ids = (j, p) => clocksFor(j, p).map(c => c.id);

ok('every clock has an id, a jurisdiction, sectors, an instrument, a period and the moment it runs from', CLOCKS.every(c => c.id && c.jurisdiction && Array.isArray(c.sectors) && c.sectors.length && c.instrument && c.where && c.to && c.what && c.from && (c.hours != null || c.days != null || c.businessDays != null)));
ok('ids are unique', new Set(CLOCKS.map(c => c.id)).size === CLOCKS.length);
ok('an Atlas-backed clock names its governed record and the date it was verified', CLOCKS.filter(c => c.atlas).every(c => /^OBL-[A-Z]+-[A-Z0-9-]+@\d+$/.test(c.atlas) && /^\d{4}-\d{2}-\d{2}$/.test(c.verified)));
ok('an Australian super trustee gets CPS 230 (72 and 24 hours), CPS 234, the Cyber Security Act and the Privacy Act, not SOCI', (() => { const x = ids('AU', 'superTrustee'); return x.includes('AU-CPS230-33') && x.includes('AU-CPS230-42') && x.includes('AU-CPS234-35') && x.includes('AU-CSA-27') && x.includes('AU-NDB-26WH') && !x.includes('AU-SOCI-30BC'); })());
ok('a general insurer and an ADI get the same APRA clocks', JSON.stringify(ids('AU', 'generalInsurer')) === JSON.stringify(ids('AU', 'adi')));
ok('a critical infrastructure baseline in Australia gets SOCI, not CPS 230', ids('AU', 'bpCiCorporate').includes('AU-SOCI-30BC') && !ids('AU', 'bpCiCorporate').includes('AU-CPS230-33'));
ok('a best-practice baseline with no jurisdiction gets no clocks', ids('any', 'bpBanking').length === 0 && ids('', 'bpBanking').length === 0);
ok('a MAS-regulated institution gets the TRM notice (1 hour) and the PDPA', ids('SG', 'masFi').includes('SG-MAS-TRM') && ids('SG', 'masFi').includes('SG-PDPA-26D'));
ok('a US bank gets the 36-hour rule and NYDFS, not HIPAA (US.8)', ids('US', 'usBanking').includes('US-BANK-36H') && ids('US', 'usBanking').includes('US-NY-500-17') && !ids('US', 'usBanking').includes('US-HIPAA-164-404'));
ok('a US health care provider gets HIPAA; securities gets Reg S-P; critical infrastructure gets CIRCIA', ids('US', 'usHealth').includes('US-HIPAA-164-404') && ids('US', 'usSecurities').includes('US-REGSP-248-30') && ids('US', 'usCriticalInfrastructure').includes('US-CIRCIA-681B-72'));
ok('the EU clocks (DORA Article 19 initial, intermediate, final; AI Act Article 73) are listed for any EU pack', ['EU-DORA-19-INITIAL', 'EU-DORA-19-INTERMEDIATE', 'EU-DORA-19-FINAL', 'EU-AIA-73'].every(i => ids('EU', 'anyPack').includes(i)));
ok('periods read as hours, days or business days', period({ hours: 1 }) === '1 hour' && period({ hours: 72 }) === '72 hours' && period({ days: 30 }) === '30 days' && period({ businessDays: 10 }) === '10 business days');
const cps = CLOCKS.find(c => c.id === 'AU-CPS230-33'), ndb = CLOCKS.find(c => c.id === 'AU-NDB-26WH');
ok('an Atlas-backed clock says so, as at the Atlas date, and that counsel confirms', basisLine(cps) === `per the Atlas as at ${ATLAS_AS_AT} (OBL-AU-CPS230-33@1, verified 2026-10-27), confirm with counsel`);
ok('a clock the Atlas does not yet carry says so, as at the reading date, and that counsel confirms', basisLine(ndb) === `not yet in the Atlas; Triodian's reading of the instrument as at ${READING_AS_AT}, confirm with counsel`);
ok('every row of the table carries the caveat', rows('AU', 'superTrustee').every(r => /confirm with counsel/.test(r[5])));
ok('72 hours from a local time comes back as a local time', endsAt({ hours: 72 }, '2026-12-18T16:30') === '2026-12-21T16:30');
ok('24 hours across a month end', endsAt({ hours: 24 }, '2026-11-30T09:00') === '2026-12-01T09:00');
ok('a time with a zone comes back as ISO UTC', endsAt({ hours: 72 }, '2026-11-14T23:00:00Z') === '2026-11-17T23:00:00.000Z');
ok('30 days', endsAt({ days: 30 }, '2026-12-18T16:30') === '2027-01-17T16:30');
ok('ten business days skip weekends (Friday 13 November to Friday 27 November)', endsAt({ businessDays: 10 }, '2026-11-13T09:00') === '2026-11-27T09:00');
ok('no start, no end', endsAt({ hours: 72 }, '') === '' && endsAt({ hours: 72 }, 'not a time') === '');
ok('stamps read for a document', stamp('2026-12-18T16:30') === '2026-12-18 16:30' && stamp('2026-11-14T23:00:00Z') === '2026-11-14 23:00 UTC' && stamp('') === '');
ok('no clock says what the law requires', CLOCKS.every(c => !/must comply|is required by|legally required|obliged to/i.test(JSON.stringify(c))));

console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
