// Sector packs in set-up (development plan tasks 3.2 and 3.3). The assessment is served from a stub, so the test
// starts from a fresh assessment whatever the shared test assessment holds; every save the page makes is captured.
import { test, expect } from '@playwright/test';
import { ADMIN } from '../helpers.js';

async function open(browser, serve) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); sessionStorage.setItem('triodian.example.left', '1'); } catch (e) {} });
  const saves = []; let rev = serve ? 1 : 0;
  await ctx.route('**/api/engagement', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: serve ? { exists: true, revision: rev, data: serve, people: [] } : { exists: false, revision: 0, people: [] } });
    const d = route.request().postDataJSON().data; saves.push(d); serve = d; rev += 1;
    return route.fulfill({ json: { revision: rev } });
  });
  const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(String(e)));
  await p.goto('/'); await p.waitForTimeout(800);
  return { ctx, p, saves };
}

test('choosing the super trustee pack changes the labels and the documents requested; an entry fixes it', async ({ browser }) => {
  const { ctx, p } = await open(browser, null);
  await p.locator('[data-act="new"]').first().click();
  await p.evaluate(() => window.AUA.go('setup'));
  const pack = p.locator('#f_engagement_sectorPack');
  await expect(pack).toHaveValue('generalInsurer');
  await pack.selectOption('superTrustee');
  await expect(p.locator('label:has(#f_engagement_insurer)').first()).toContainText('Trustee');
  const st = await p.evaluate(() => ({ pack: window.AUA.state.engagement.sectorPack, d6: window.AUA.state.documents.find(d => d.ref === 'D6').title, roles: window.AUA.content().roles.find(r => r.id === 'owner').name }));
  expect(st).toEqual({ pack: 'superTrustee', d6: 'Administration agreement and group insurance policy, with the authority each provider holds over member decisions', roles: 'Arrangement owner (trustee)' });
  const saved = await p.evaluate(() => window.AUA.save());
  expect(p._errors).toEqual([]);
  await ctx.close();

  const withEntry = JSON.parse(JSON.stringify(saved)); withEntry.entries = [{ id: 'REG-001', arrangementId: 'ARR-01', fields: {} }];
  const b = await open(browser, withEntry);
  await b.p.evaluate(() => window.AUA.go('setup'));
  await expect(b.p.locator('#f_engagement_sectorPack')).toBeDisabled();
  await expect(b.p.locator('#f_engagement_sectorPack')).toHaveValue('superTrustee');
  expect(b.p._errors).toEqual([]);
  await b.ctx.close();
});

// The in-use feed (task 3.7) from the worked example: the v1 entries, plus the measures, gaps by priority and overdue items.
test('the worked example gives an in-use feed v2 with the measures it can count', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('/'); await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  const x = await p.evaluate(() => ({ v1: window.AUA.extract(), v2: window.AUA.extractV2() }));
  expect(x.v2.schema).toBe('triodian.aua.extract.v2');
  expect(x.v2.entries).toEqual(x.v1.entries);
  expect(x.v2.measures.map(m => m.ref)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']);
  for (const m of x.v2.measures) { expect(typeof m.basis).toBe('string'); expect(m.value === null || typeof m.value === 'number').toBe(true); }
  expect(Object.keys(x.v2.gapsByPriority)).toEqual(['High', 'Medium', 'Low']);
  expect(errs).toEqual([]);
  await ctx.close();
});

// Lite scope (task R.3): the worked example run in Lite scope covers the arrangements behind critical operations, and
// every output says so, naming what was left out.
test('in Lite scope the outputs cover the arrangements behind critical operations and name the rest', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('/'); await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  const full = await p.evaluate(() => window.AUA.output('DL1'));
  expect(full).not.toContain('Scope: Lite');
  const r = await p.evaluate(() => {
    const S = window.AUA.state; S.engagement.scope = 'lite'; window.AUA.setState(S);
    return { all: S.arrangements.map(a => a.id), outs: ['DL1', 'DL2', 'DL5', 'DL6', 'RP', 'CM'].map(id => window.AUA.output(id)) };
  });
  const line = /\*\*Scope: Lite\.\*\* \d+ arrangements? behind critical operations (?:is|are) assessed: ([^.]+)\./.exec(r.outs[0]);
  expect(line).not.toBeNull();
  r.crit = line[1].split(', ');
  const left = r.all.filter(id => !r.crit.includes(id));
  expect(r.crit.length).toBeGreaterThan(0);
  expect(left.length).toBeGreaterThan(0);
  for (const md of r.outs) {
    expect(md).toContain(`**Scope: Lite.** ${r.crit.length} arrangement`);
    for (const id of left) expect(md).toContain(id); // named as left out
  }
  // the register output lists only the entries in scope
  const dl1 = r.outs[0].split('**Scope: Lite.**')[1].split('\n\n').slice(1).join('\n\n');
  for (const id of left) expect(dl1).not.toMatch(new RegExp(`\\| ${id} \\|`));
  await p.evaluate(() => window.AUA.go('set'));
  await expect(p.locator('body')).toContainText('Lite scope:');
  expect(errs).toEqual([]);
  await ctx.close();
});
