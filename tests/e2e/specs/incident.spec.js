// AI Incident Accountability, Shape A (development plan tasks A.2 to A.7): the readiness card on the Classify screen, the
// Incident readiness record (DL11), the evidence-preservation holds (DL12) and the exercise and incident record (VE),
// generated from the Coastline Super worked example, which runs the 13 November 2026 scenario; then the role rules on a
// real engagement through the API and the evidence feed.
import { test, expect } from '@playwright/test';
import { api, editAs, pageAs, U, ADMIN } from '../helpers.js';

test.describe.configure({ mode: 'serial' });

const stored = async (as = ADMIN) => (await api('GET', '/api/engagement', undefined, as)).body;
const unchanged = async (before, r, status) => { expect(r.status, JSON.stringify(r.body)).toBe(status); expect((await stored()).revision).toBe(before.revision); };

test('Coastline Super runs the 13 November scenario: readiness, holds and the exercise come out as DL11, DL12 and VE', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 }, timezoneId: 'Australia/Brisbane', locale: 'en-AU' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('/?example=superannuation');
  await expect(p.locator('.examplenote', { hasText: 'Coastline Super' })).toBeVisible({ timeout: 15_000 });
  const got = await p.evaluate(() => { const S = window.AUA.state; return { dl11: window.AUA.output('DL11'), dl12: window.AUA.output('DL12'), ve: window.AUA.output('VE'), rd: S.entries.map(e => e.readiness), holds: Object.keys(S.holds), ex: S.exercises.map(x => x.ref) }; });
  // readiness is on the register: three entries in full, the F4 entry with one field
  expect(got.rd[0].holder).toBe('Southgate Group Life Ltd (fictional)'); expect(got.rd[3].holder).toBeUndefined();
  // DL11: the summary, the clocks with their caveat, the gaps with owners
  expect(got.dl11).toContain('# DL11 · Incident readiness record');
  expect(got.dl11).toContain('Evidence for: APRA letter S1, G2, P2 · CPS 230 33, 42, 54 · ISO/IEC 42001 A.3.2, A.6.2.8, A.10.3');
  expect(got.dl11).toContain('| CPS 230, para 33 |'); expect(got.dl11).toContain('72 hours'); expect(got.dl11).toContain('per the Atlas as at 2026-11-15 (OBL-AU-CPS230-33@1, verified 2026-10-27), confirm with counsel');
  expect(got.dl11).toContain('| CPS 230, para 42 |'); expect(got.dl11).toContain('24 hours');
  expect(got.dl11).toContain('Southgate Group Life Ltd (fictional) (the AI vendor)');
  expect(got.dl11).toContain('| REG-004 | ARR-03 | Runtime records that would show what it did, when and under whose authority | The arrangement owner, with the provider |');
  expect(got.dl11).toContain('| REG-004 | ARR-03 | Accountable person for the change process touching both | The CRO |');
  expect(got.dl11).not.toContain('| REG-001 | ARR-01 | Record holder |');
  expect(got.dl11).toContain('TR4 | AI incident');
  expect(got.dl11).toContain('Exercises and incidents recorded against this arrangement: VE-01 exercise, 18 December 2026');
  // DL12: three holders, one letter settled by counsel, drafted and never sent
  expect(got.dl12).toContain('## HOLD-01 · Southgate Group Life Ltd (fictional)'); expect(got.dl12).toContain('Settled by counsel: Meredith Vance, 19 December 2026.');
  expect(got.dl12).toContain('## HOLD-02 · Tallowfield Analytics (fictional)'); expect(got.dl12).toContain('DRAFT · not yet settled by counsel.');
  expect(got.dl12).toContain('## HOLD-03 · Northwind Cloud Pty Ltd (fictional)');
  expect(got.dl12).toContain('Please include the change tickets raised on the claims platform between 11 and 18 December 2026.');
  expect(got.dl12).toContain('The app never sends a letter');
  expect(got.dl12).toContain('under cl.18.3 (the trustee may examine claims statistics and financial records relating to the Policy); it does not name the routing log.');
  // VE: the event, the breach test, the clocks with when each ends, the line, the seams, the finding, the review
  expect(got.ex).toEqual(['VE-01']);
  expect(got.ve).toContain('## VE-01 · Exercise · The Saturday Morning Question');
  expect(got.ve).toContain('| REG-001 |'); expect(got.ve).toContain('| REG-002 |'); expect(got.ve).not.toContain('| REG-003 |');
  expect(got.ve).toContain('| C5 Critical disruption · Insurance claims handling | Not breached |');
  expect(got.ve).toContain('| C4 Member harm | Not known yet |');
  expect(got.ve).toContain('| TR4 AI incident |'); expect(got.ve).toContain('CRO and the accountable person for the function by 2026-12-19 05:10');   // 12 hours from 17:10 (P10)
  expect(got.ve).toContain('| CPS 230, para 33 |'); expect(got.ve).toContain('| Runs | 2026-12-18 16:30 | 2026-12-21 16:30 |');            // 72 hours from becoming aware
  expect(got.ve).toContain('| CPS 230, para 42 |'); expect(got.ve).toContain('| Does not run |');
  expect(got.ve).toContain('Clocks confirmed by the GC: Rohan Castellano, 18 December 2026.');
  expect(got.ve).toContain('Settled by counsel: Meredith Vance, 18 December 2026.');
  expect(got.ve).toContain('Who may speak to it: Anjali Deshmukh, CRO');
  expect(got.ve).toContain('The seam no one holds is the change process on shared infrastructure');
  expect(got.ve).toContain('Independent review: Ingrid Solberg, 22 December 2026');
  expect(got.ve).toContain('Asserted by Anjali Deshmukh, 18 December 2026.');
  // the Findings card and the Classify screen show it
  await p.evaluate(() => window.AUA.go('findings'));
  await expect(p.locator('#ws-ARR-01')).toContainText('VE-01');
  await expect(p.locator('#ws-ARR-01')).toContainText('Reviewed');
  await p.evaluate(() => window.AUA.go('classify'));
  await expect(p.locator('#readiness')).toContainText('Readiness recorded in full.');
  await p.evaluate(() => window.AUA.go('review'));
  await expect(p.locator('#ex-VE-01')).toContainText('Ends 2026-12-21 16:30 (72 hours from 2026-12-18 16:30)');
  await expect(p.locator('#ex-VE-01')).toContainText('Notify CRO and the accountable person for the function by 2026-12-19 05:10');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('the general insurer example has no readiness yet: DL11 lists every field as a gap with an owner, and DL12 and VE say so', async ({ browser }) => {
  const p = await pageAs(browser, ADMIN, '/?example=insurer');
  await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  const got = await p.evaluate(() => ({ dl11: window.AUA.output('DL11'), dl12: window.AUA.output('DL12'), ve: window.AUA.output('VE') }));
  expect(got.dl11).toContain('| Shared infrastructure it runs on or touches | not recorded | The technology owner |');
  expect(got.dl12).toContain('No record holder is named yet.');
  expect(got.ve).toContain('No exercise or incident has been recorded.');
  expect(p._errors).toEqual([]);
  await p.context().close();
});

let ids = {};
const RUN = Date.now().toString(36);   // unique names per run, so the spec can run again on the same database
test('on a real engagement: readiness is a fact, an exercise is recorded, counsel settles the line, the GC the clocks, the reviewer the review', async ({ browser }) => {
  ids = Object.fromEntries((await api('GET', '/api/admin/users')).body.users.map(u => [u.email, u.id]));
  if (!(await stored()).exists) {
    const mo = await pageAs(browser, U.mo); await mo.click('[data-act="new"]');
    await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 }); await mo.context().close();
  }
  const cur = await stored();
  if (!cur.data.arrangements.some(a => a.id === 'ARR-IA')) {
    const r = await editAs(U.mo, d => {
      d.arrangements.push({ id: 'ARR-IA', name: 'Incident accountability test', parties: 'Vendor', boundaries: ['B1'], reason: 'test' });
      d.entries.push({ id: 'REG-IA1', arrangementId: 'ARR-IA', fields: {}, authorityTests: [0, 0, 0, 0].map(() => ({ answer: null, source: '' })), tierProposed: '', tierOverrideReason: '', classifiedBy: '', reviewedBy: '', consequenceConfirmedBy: '', consequenceConfirmedOn: '', obtainability: { start: '', rungs: {} }, confChosen: '', confRaiseReason: '', peerReview: { personId: '', tier: '', differs: false, resolution: '', on: '' }, notDeterminable: { on: false, question: '', who: '', since: '' }, dl3Rows: [], readiness: {} });
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
  }
  const RD = { infrastructure: 'Shared gateway', records: 'Action log', holderKind: 'vendor', holder: `Vendor ${RUN} Pty Ltd`, clause: 'cl.9', production: '5 business days', farSystem: 'A', farInfrastructure: 'B', farChange: 'C' };
  const ent = d => d.entries.find(e => e.id === 'REG-IA1');
  await unchanged(await stored(), await editAs(U.owner, d => { ent(d).readiness = { ...RD, holder: 'Owner Pty Ltd' }; }), 403);                        // not a fact the owner records
  expect((await editAs(U.assessor, d => { ent(d).readiness = RD; })).status).toBe(200);
  expect(ent((await stored()).data).readiness.holder).toBe(`Vendor ${RUN} Pty Ltd`);
  const ex = { ref: `VE-${RUN}`, kind: 'incident', title: 'Test incident', date: '2026-11-13', awareAt: '2026-11-13T16:30', infrastructure: 'Shared gateway', entryIds: ['REG-IA1'], unknowns: '', parties: [{ party: 'Vendor', said: 'Not us', showed: 'nothing' }], tolerances: {}, triggers: {}, breachAssertedBy: '', breachAssertedOn: '', clocks: { 'AU-CPS230-33': { runs: 'runs', startedAt: '' } }, clocksConfirmedBy: '', clocksConfirmedOn: '', line: '', speaker: '', lineSettledBy: '', lineSettledOn: '', seams: '', finding: '', recordsTime: '', exposure: '', actions: '', recordedBy: ids[U.cro], recordedOn: '2026-11-13', reviewedBy: '', reviewedOn: '', reviewNote: '' };
  expect((await editAs(U.cro, d => { d.exercises = [...(d.exercises || []).filter(x => x.ref !== `VE-${RUN}`), ex]; })).status).toBe(200);
  const X = d => d.exercises.find(x => x.ref === `VE-${RUN}`);
  await unchanged(await stored(), await editAs(U.ir, d => { X(d).finding = 'x'; }), 403);                               // the reviewer records nothing but the review
  await unchanged(await stored(), await editAs(U.assessor, d => { X(d).lineSettledBy = ids[U.assessor]; X(d).lineSettledOn = '2026-11-14'; }), 403);
  expect((await editAs(U.counsel, d => { X(d).line = 'Our line.'; X(d).speaker = 'The CRO'; X(d).lineSettledBy = ids[U.counsel]; X(d).lineSettledOn = '2026-11-14'; })).status).toBe(200);
  await unchanged(await stored(), await editAs(U.counsel, d => { X(d).clocksConfirmedBy = ids[U.counsel]; X(d).clocksConfirmedOn = '2026-11-14'; }), 403);
  expect((await editAs(U.gc, d => { X(d).clocksConfirmedBy = ids[U.gc]; X(d).clocksConfirmedOn = '2026-11-14'; })).status).toBe(200);
  expect((await editAs(U.cro, d => { X(d).tolerances = { c4: { result: 'notBreached', note: 'no claim affected' } }; X(d).breachAssertedBy = ids[U.cro]; X(d).breachAssertedOn = '2026-11-14'; })).status).toBe(200);
  await unchanged(await stored(), await editAs(U.owner, d => { X(d).reviewedBy = ids[U.owner]; X(d).reviewedOn = '2026-11-20'; }), 403);
  expect((await editAs(U.ir, d => { X(d).reviewedBy = ids[U.ir]; X(d).reviewedOn = '2026-11-20'; X(d).reviewNote = 'Sound.'; })).status).toBe(200);
  await unchanged(await stored(), await editAs(U.cro, d => { X(d).tolerances.c4.result = 'breached'; }), 403);         // reviewed: the test is fixed
  const s = X((await stored()).data);
  expect(s.lineSettledBy).toBe(ids[U.counsel]); expect(s.clocksConfirmedBy).toBe(ids[U.gc]); expect(s.reviewedBy).toBe(ids[U.ir]); expect(s.breachAssertedBy).toBe(ids[U.cro]);
});

test('the hold letter: Triodian drafts it, counsel alone marks it settled, and a settled draft is fixed', async () => {
  const K = `vendor_${RUN}_pty_ltd`;
  expect((await editAs(U.assessor, d => { d.holds = { ...(d.holds || {}), [K]: { addressee: 'General counsel', note: 'Change tickets too.', from: '' } }; })).status).toBe(200);
  await unchanged(await stored(), await editAs(U.assessor, d => { d.holds[K].settledBy = ids[U.assessor]; d.holds[K].settledOn = '2026-11-14'; }), 403);
  await unchanged(await stored(), await editAs(U.counsel, d => { d.holds[K].settledBy = ids[U.mo]; d.holds[K].settledOn = '2026-11-14'; }), 403);
  expect((await editAs(U.counsel, d => { d.holds[K].settledBy = ids[U.counsel]; d.holds[K].settledOn = '2026-11-14'; })).status).toBe(200);
  await unchanged(await stored(), await editAs(U.assessor, d => { d.holds[K].note = 'changed'; }), 403);
  const d = (await stored()).data; expect(d.holds[K].settledBy).toBe(ids[U.counsel]);
});

test('the evidence feed lists the three outputs with their status, and the outputs render for every role', async ({ browser }) => {
  const r = await api('GET', '/api/evidence'); expect(r.status).toBe(200);
  const by = Object.fromEntries(r.body.artefacts.map(a => [a.id, a]));
  expect(['draft', 'recorded']).toContain(by.DL11.status); expect(by.DL11.letter).toEqual(['S1', 'G2', 'P2']);
  expect(['draft', 'recorded']).toContain(by.DL12.status);                  // this run's letter is settled; an earlier run's may not be
  expect(['draft', 'recorded']).toContain(by.VE.status);
  const p = await pageAs(browser, U.counsel);
  await p.evaluate(() => window.AUA.go('outputs'));
  for (const id of ['DL11', 'DL12', 'VE']) { await p.click(`[data-act="outTab"][data-t="${id}"]`); await expect(p.locator('#out-back')).toBeVisible(); await p.click('#out-back'); }
  await p.click('[data-act="outTab"][data-t="DL12"]');
  await expect(p.locator('main')).toContainText('Settled · counsel (test)');
  expect(p._errors).toEqual([]);
  await p.context().close();
});
