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
