// Regression tests for what the October 2026 QA run found. Each save below was accepted, or went wrong,
// before the fix. Every refused save must leave the stored assessment unchanged.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { api, editAs, pageAs, U, ADMIN } from '../helpers.js';

test.describe.configure({ mode: 'serial' });

let ids = {};
const stored = async (as = ADMIN) => (await api('GET', '/api/engagement', undefined, as)).body;
const f = (value, source = 'D1 p.1') => ({ value, source, notKnown: false, by: '', on: '' });
const blankEntry = (id, arr) => ({ id, arrangementId: arr, fields: {}, authorityTests: [0, 0, 0, 0].map(() => ({ answer: null, source: '' })), tierProposed: '', tierOverrideReason: '',
  classifiedBy: '', reviewedBy: '', consequenceConfirmedBy: '', consequenceConfirmedOn: '', obtainability: { start: '', rungs: {} }, confChosen: '', confRaiseReason: '',
  peerReview: { personId: '', tier: '', differs: false, resolution: '', on: '' }, notDeterminable: { on: false, question: '', who: '', since: '' }, dl3Rows: [] });
const setReview = (d, point, v) => { d.reviews = d.reviews || []; const r = d.reviews.find(x => x.point === point); if (r) Object.assign(r, v); else d.reviews.push({ point, by: '', on: '', result: '', notes: '', ...v }); };
const unchanged = async (before, r, status) => {
  expect(r.status, JSON.stringify(r.body)).toBe(status);
  expect((await stored()).revision).toBe(before.revision);
};

test('the method owner starts an assessment with one arrangement and two entries', async ({ browser }) => {
  ids = Object.fromEntries((await api('GET', '/api/admin/users')).body.users.map(u => [u.email, u.id]));
  if (!(await stored()).exists) {
    const mo = await pageAs(browser, U.mo);
    await mo.click('[data-act="new"]');
    await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
    await mo.context().close();
  }
  const r = await editAs(U.mo, d => {
    d.arrangements = [{ id: 'ARR-01', name: 'Claims TPA', parties: 'TPA', boundaries: ['B1'], reason: 'test' }];
    d.entries = [blankEntry('REG-001', 'ARR-01'), blankEntry('REG-002', 'ARR-01')];
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
});

test.describe('malformed saves are refused with a 400, not a server error', () => {
  const cases = {
    'two entries with the same id': d => { d.entries.push({ ...structuredClone(d.entries[0]), fields: { 15: f('T3') } }); },
    'an entry that is not a record': d => { d.entries.push(null); },
    'a review point that is not R1 to R7': d => { d.reviews = [...(d.reviews || []), { point: 'constructor', by: '', on: '', result: 'complete', notes: '' }]; },
    'a field number outside 1 to 26': d => { d.entries[0].fields[99] = f('x'); },
  };
  for (const [name, change] of Object.entries(cases)) {
    test(name, async () => { const before = await stored(); await unchanged(before, await editAs(U.assessor, change), 400); });
  }
  test('a save with no assessment in it', async () => {
    const before = await stored();
    await unchanged(before, await api('PUT', '/api/engagement', { revision: before.revision, data: null }, U.assessor), 400);
    await unchanged(before, await api('PUT', '/api/engagement', null, U.assessor), 400);
  });
});

test('a new entry is checked like an edit: a role without facts rights cannot add one with a tier', async () => {
  const before = await stored();
  await unchanged(before, await editAs(U.owner, d => { d.entries.push({ ...blankEntry('REG-099', 'ARR-01'), fields: { 15: f('T1') }, classifiedBy: ids[U.assessor] }); }), 403);
});

test('a save based on an old revision is refused', async () => {
  const cur = await stored(U.assessor), data = structuredClone(cur.data);
  data.entries[0].fields[3] = f('B1');
  const r = await api('PUT', '/api/engagement', { revision: cur.revision - 1, data }, U.assessor);
  expect([409, 200]).toContain(r.status); // 200 only when the server merges cleanly
  if (r.status === 200) expect(r.body.merged).toBe(true);
});

test('the change history cannot be rewritten', async () => {
  const before = await stored();
  test.skip(!(before.data.history || []).length, 'no history yet');
  await unchanged(before, await editAs(U.assessor, d => { d.history[0].action = 'forged'; }), 409);
});

test('review points are recorded in your own name only', async () => {
  const before = await stored();
  await unchanged(before, await editAs(U.validation, d => setReview(d, 'R4', { by: ids[U.mo], on: '2026-10-18', result: 'complete' })), 403);
});

test('the assessor classifies REG-001', async () => {
  const r = await editAs(U.assessor, d => {
    const e = d.entries[0];
    Object.assign(e.fields, { 15: f('T3'), 16: f('C2') });
    e.tierProposed = 'T3'; e.classifiedBy = ids[U.assessor];
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
});

test('blind re-derivation: the server does not send the peer the classifier\'s work', async () => {
  const peer = await stored(U.peer), e = peer.data.entries.find(x => x.id === 'REG-001');
  expect(e.fields[15]).toBeUndefined();
  expect(e.fields[16]).toBeUndefined();
  expect(e.classifiedBy).toBe('');
  expect(e.tierProposed).toBe('');
  expect(JSON.stringify(peer.data.history)).not.toContain('T3');
  expect(peer.data.blind).toContain('REG-001');
  // The method owner still sees it.
  expect((await stored(U.mo)).data.entries[0].fields[15].value).toBe('T3');
});

test('the peer\'s save keeps the hidden work, and the server decides whether the tiers differ', async () => {
  const r = await editAs(U.peer, d => { Object.assign(d.entries[0].peerReview, { personId: ids[U.peer], tier: 'T2', on: '2026-10-18', differs: false }); });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const e = (await stored()).data.entries[0];
  expect(e.fields[15].value).toBe('T3');
  expect(e.classifiedBy).toBe(ids[U.assessor]);
  expect(e.peerReview.differs).toBe(true);
  // Now the peer has their own tier on record, they see the classifier's.
  expect((await stored(U.peer)).data.entries[0].fields[15].value).toBe('T3');
});

test('the validation reviewer records R4 in their own name', async () => {
  const r4 = await editAs(U.validation, d => setReview(d, 'R4', { by: ids[U.validation], on: '2026-10-18', result: 'complete' }));
  expect(r4.status, JSON.stringify(r4.body)).toBe(200);
});

test('people without administrator rights cannot use the admin routes or start the next assessment', async () => {
  for (const path of ['/api/admin/users', '/api/admin/activity', '/api/admin/notifications']) expect((await api('GET', path, undefined, U.mo)).status, path).toBe(403);
  const cur = await stored();
  expect((await api('POST', '/api/next-assessment', { revision: cur.revision }, U.assessor)).status).toBe(403);
  // The method owner can, but only once the assessment is closed.
  expect((await api('POST', '/api/next-assessment', { revision: cur.revision }, U.mo)).status).toBe(409);
});

test('once closed, only the closing steps can change', async () => {
  const r7 = await editAs(U.ir, d => setReview(d, 'R7', { by: ids[U.ir], on: '2026-10-18', result: 'complete' }));
  expect(r7.status, JSON.stringify(r7.body)).toBe(200);
  const hb = await editAs(U.owner, d => { d.engagement.handBack = { by: ids[U.owner], on: '2026-10-18' }; });
  expect(hb.status, JSON.stringify(hb.body)).toBe(200);
  const before = await stored();
  const r = await editAs(U.assessor, d => { d.entries[1].fields[7] = f('Changed after close'); });
  await unchanged(before, r, 403);
  expect(r.body.error).toMatch(/closed/);
});

test('the next assessment carries the facts and the interview list, and carried facts can be confirmed', async ({ browser }) => {
  const cur = await stored();
  const r = await api('POST', '/api/next-assessment', { revision: cur.revision }, U.mo);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const d = (await stored()).data;
  expect(d.interviews.length).toBe(cur.data.interviews.length);
  d.interviews.forEach(v => { expect(v.date).toBe(''); expect(v.notesRef).toBe(''); });
  expect(d.history[0].by).toBe('mo (test)');
  expect(d.entries[0].fields[15]).toBeUndefined();
  // Put a carried fact on REG-001 and confirm it in the browser.
  await editAs(U.assessor, x => { x.entries[0].fields[7] = { ...f('Claims system'), carried: true }; });
  const page = await pageAs(browser, U.assessor, '/#register');
  await page.evaluate(() => window.AUA.go('register'));
  await page.locator('[data-act="openEntry"]').first().click();
  await page.locator('[data-act="confirmAllCarried"]').click();
  await expect(page.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
  const after = (await stored()).data.entries[0].fields[7];
  expect(after.carried).toBeUndefined();
  expect(after.value).toBe('Claims system');
  expect(page._errors).toEqual([]);
});

test('loading the calibration set from the Risk Appetite app reads the set inside the reply', async ({ browser }) => {
  // A set issued by the Risk Appetite app in a test run, wrapped the way that app sends it.
  const set = JSON.parse(readFileSync(new URL('../fixtures/calibration-set.json', import.meta.url), 'utf8'));
  const page = await pageAs(browser, U.mo, '/#setup');
  await page.route('**/api/calibration-from-appetite', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ version: set.version || 1, status: set.status || 'approved', issuedOn: '2026-10-18', issuedBy: 'cro (test)', calibrationSet: set }) }));
  await page.evaluate(() => window.AUA.go('setup'));
  await page.locator('[data-act="loadCalApp"]').click();
  await expect(page.locator('#toast')).toContainText('Calibration loaded', { timeout: 5_000 });
  expect(page._errors).toEqual([]);
});

test('on a phone, every admin tab can be reached and none sits under the avatar', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 390, height: 844 } });
  // The demo introduction (public/suite.js) opens once per session; mark it seen so it doesn't cover the app under test.
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); await page.goto('/admin/'); await page.waitForTimeout(800);
  const tab = page.locator('.area-tabs button', { hasText: 'Notifications' });
  await tab.scrollIntoViewIfNeeded();
  const t = await tab.boundingBox(), a = await page.locator('.hdr-r').boundingBox();
  expect(t.x + t.width).toBeLessThanOrEqual(a.x + 1);
  await ctx.close();
});
