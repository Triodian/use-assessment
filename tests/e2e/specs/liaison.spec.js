// Updates and consultation after the hand-over (development plan task 7.4, part B): counsel releases an update, the
// technology owner and the AI governance team contest a point, ask for a consultation and confirm facts.
import { test, expect } from '@playwright/test';
import { pageAs, U, api, editAs } from '../helpers.js';

const toCounsel = p => p.locator('nav.steps [data-act="go"][data-to="counsel"]').first().click();
async function ensureEntry(browser) {
  if (!(await api('GET', '/api/engagement', undefined, U.mo)).body.exists) {
    const mo = await pageAs(browser, U.mo);
    await mo.click('[data-act="new"]');
    await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
    await mo.context().close();
  }
  const d = (await api('GET', '/api/engagement', undefined, U.mo)).body.data;
  if (d.entries.some(e => e.id === 'REG-901')) return;
  const r = await editAs(U.mo, x => {
    x.arrangements.push({ id: 'ARR-90', name: 'Outside claims manager', parties: '', boundaries: ['B1'], criteria: [], reason: '', nextContracting: '', function: 'Claims', findingOwner: '' });
    x.entries.push({ id: 'REG-901', arrangementId: 'ARR-90', fields: { 7: { value: 'Claims triage model', source: 'D1', notKnown: false }, 12: { value: '', source: '', notKnown: true } } });
  });
  expect(r.status).toBe(200);
}

test('counsel releases an update; the two roles read it, with no legal determination unless counsel includes one', async ({ browser }) => {
  await ensureEntry(browser);
  expect((await api('GET', '/api/engagement', undefined, U.aiGovernance)).body.data.liaison.updates.length).toBe(0);
  expect((await api('PUT', '/api/liaison', { action: 'release', stage: 'x', rows: [] , note: 'n' }, U.mo)).status).toBe(403);
  const co = await pageAs(browser, U.counsel);
  await toCounsel(co);
  await expect(co.locator('#li_release')).toContainText('REG-901');
  await expect(co.locator('#li_legal')).not.toBeChecked();
  await co.locator('#li_note').fill('As it stands after the register was completed.');
  await co.click('[data-li="release"]'); await co.click('[data-li="release"]');
  await expect(co.locator('#toast')).toContainText('The update is released');
  await expect(co.locator('#liaison')).toContainText('no legal determination included');
  expect(co._errors).toEqual([]);
  await co.context().close();
  const v = (await api('GET', '/api/engagement', undefined, U.technologyOwner)).body.data;
  expect(v.liaison.updates.length).toBe(1);
  expect(v.liaison.updates[0].rows.find(r => r.entryId === 'REG-901')).toMatchObject({ arrangement: 'Outside claims manager', system: 'Claims triage model' });
  expect(v.liaison.updates[0].rows.every(r => !('legal' in r))).toBe(true);
  expect(Object.keys(v).sort()).toEqual(['closed', 'engagement', 'handover', 'liaison', 'people', 'schema']);
});

test('a point is contested and answered, a consultation is held, and facts are confirmed', async ({ browser }) => {
  await ensureEntry(browser);
  if (!(await api('GET', '/api/engagement', undefined, U.mo)).body.data.liaison) await api('PUT', '/api/liaison', { action: 'release', stage: 'End of phase 2 · Map the AI', rows: [{ entryId: 'REG-901', arrangement: 'Outside claims manager', system: 'Claims triage model' }] }, U.counsel);
  // the AI governance team contests a point and asks nothing else of the register
  const ag = await pageAs(browser, U.aiGovernance);
  await expect(ag.locator('#li_updates')).toContainText('Claims triage model');
  await ag.locator('[data-li="startContest"][data-entry="REG-901"]').first().click();
  await ag.fill('#li_reason', 'A claims handler confirms each route, so the model does not decide.');
  await ag.fill('#li_evidence', 'Procedure CP-14, section 3; claims team');
  await ag.click('[data-li="contest"]');
  await expect(ag.locator('#li_contests')).toContainText('Open');
  // the technology owner asks for a consultation
  expect(ag._errors).toEqual([]);
  await ag.context().close();
  const cio = await pageAs(browser, U.technologyOwner);
  await cio.fill('#li_topic', 'How the tier was reached for the claims manager');
  await cio.click('[data-li="askConsultation"]');
  await expect(cio.locator('#li_consult')).toContainText('Not yet held');
  expect(cio._errors).toEqual([]);
  await cio.context().close();

  // the register is as it was: a contested point changes nothing by itself
  const before = (await api('GET', '/api/engagement', undefined, U.mo)).body.data;
  expect(before.entries.find(e => e.id === 'REG-901').fields[7].value).toBe('Claims triage model');
  const cid = before.liaison.contests.at(-1).id, sid = before.liaison.consultations.at(-1).id;
  expect((await api('PUT', '/api/liaison', { action: 'decide', id: cid, outcome: 'accepted', decision: 'ok' }, U.counsel)).status).toBe(403);

  // the assessor keeps the position and says why
  const as = await pageAs(browser, U.assessor);
  await toCounsel(as);
  await as.fill(`#li_dec_${cid}`, 'CP-14 covers complex claims only; standard claims route without a handler.');
  await as.click(`[data-li="decide"][data-id="${cid}"][data-outcome="kept"]`);
  await expect(as.locator('#liaison')).toContainText('Position kept');
  expect(as._errors).toEqual([]);
  await as.context().close();
  // the delivery manager records the consultation as held
  const dm = await pageAs(browser, U.delivery);
  await toCounsel(dm);
  await dm.fill(`#li_held_${sid}`, '2026-11-13'); await dm.fill(`#li_out_${sid}`, 'Walked through the tests; nothing to change.');
  await dm.click(`[data-li="hold"][data-id="${sid}"]`);
  await expect(dm.locator('#liaison')).toContainText('Walked through the tests');
  await dm.context().close();
  // counsel names two facts; the two roles answer them
  const co = await pageAs(browser, U.counsel);
  await toCounsel(co);
  await co.fill('#li_facts', 'The model runs in Australia.\nStaff cannot change its settings.');
  await co.click('[data-li="askReview"]');
  await expect(co.locator('#toast')).toContainText('The facts are sent');
  await co.context().close();
  const facts = (await api('GET', '/api/engagement', undefined, U.mo)).body.data.liaison.reviews.at(-1).facts;
  const cio2 = await pageAs(browser, U.technologyOwner);
  await expect(cio2.locator('#li_contests')).toContainText('CP-14 covers complex claims only');   // the answer came back to them
  await expect(cio2.locator('#li_consult')).toContainText('Walked through the tests');
  await cio2.click(`[data-li="fact"][data-id="${facts[0].id}"][data-answer="correct"]`);
  await expect(cio2.locator('#toast')).toContainText('Your answer is recorded');
  await cio2.fill(`[id="li_cor_${facts[1].id}"]`, 'Two people in claims operations can change the thresholds.');
  await cio2.click(`[data-li="fact"][data-id="${facts[1].id}"][data-answer="incorrect"]`);
  await expect(cio2.locator('#li_reviews')).toContainText('Not correct');
  expect(cio2._errors).toEqual([]);
  await cio2.context().close();

  // the independent reviewer's pack shows the contested point with its answer
  const ir = await pageAs(browser, U.ir);
  const pack = await ir.evaluate(() => window.AUA.output('RP'));
  expect(pack).toContain('Points contested by the technology owner and the AI governance team');
  expect(pack).toContain('Position kept. CP-14 covers complex claims only');
  await ir.context().close();
  // and an ordinary save cannot rewrite the record
  const save = await editAs(U.mo, d => { d.liaison.contests = []; d.engagement.reference = 'LI-1'; });
  expect(save.status).toBe(200);
  expect((await api('GET', '/api/engagement', undefined, U.mo)).body.data.liaison.contests.length).toBeGreaterThan(0);
});

test('in the worked example, acting as the technology owner shows only what that role sees', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': U.mo }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('/');
  await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  await p.locator('nav.steps [data-act="go"][data-to="counsel"]').first().click();
  await expect(p.locator('#liaison')).toContainText('Update U1');
  await p.selectOption('#who-hdr', 'p11');   // Imogen Hart, the chief information officer
  await expect(p.locator('h1')).toHaveText('Your hand-over');
  await expect(p.locator('nav.steps')).toHaveCount(0);
  await expect(p.locator('#li_updates')).toContainText('no legal determination included');
  await expect(p.locator('#li_contests')).toContainText('Position kept');
  await expect(p.locator('#li_reviews')).toContainText('Two people in claims operations can change the routing thresholds');
  await expect(p.locator('body')).not.toContainText('QC-01');
  await p.selectOption('#who-hdr', 'p5');    // back to the assessor
  await expect(p.locator('nav.steps')).toHaveCount(1);
  expect(errs).toEqual([]);
  await ctx.close();
});
