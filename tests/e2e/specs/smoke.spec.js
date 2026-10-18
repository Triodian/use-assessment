// Every screen loads without script errors, in the worked example and in a saved assessment.
import { test, expect } from '@playwright/test';
import { pageAs, U, api } from '../helpers.js';

const SCREENS = ['overview', 'actions', 'setup', 'set', 'register', 'classify', 'counsel', 'findings', 'review', 'outputs', 'reference'];

test('worked example: every screen and every output opens without errors', async ({ browser }) => {
  const page = await pageAs(browser, U.assessor);
  await page.click('[data-act="example"]');
  for (const s of SCREENS) { await page.evaluate(s => window.AUA.go(s), s); await page.waitForTimeout(150); }
  await page.evaluate(() => window.AUA.go('outputs'));
  const n = await page.locator('.outrow').count();
  expect(n).toBe(10);
  for (let i = 0; i < n; i++) { await page.locator('.outrow').nth(i).click(); await expect(page.locator('#out-back')).toBeVisible(); await page.click('#out-back'); }
  expect(page._errors).toEqual([]);
});

test('the method owner starts the assessment; everyone can open every screen', async ({ browser }) => {
  const mo = await pageAs(browser, U.mo);
  await mo.click('[data-act="new"]');
  await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
  const e = await api('GET', '/api/engagement', undefined, U.mo);
  expect(e.body.exists).toBe(true);
  for (const who of Object.values(U)) {
    const p = await pageAs(browser, who, '/#overview');
    for (const s of SCREENS) { await p.evaluate(s => window.AUA.go(s), s); await p.waitForTimeout(80); }
    expect(p._errors, who).toEqual([]);
    await p.context().close();
  }
});

test('admin, profile and user guide pages load', async ({ browser }) => {
  for (const path of ['/admin/', '/admin/#activity', '/admin/#notifications', '/profile/', '/user-guide/']) {
    const p = await pageAs(browser, 'damian.hickey@triodian.com', path);
    expect(p._errors, path).toEqual([]);
    await p.context().close();
  }
});
