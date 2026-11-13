// Every screen loads without script errors, in the worked example and in a saved assessment.
import { test, expect } from '@playwright/test';
import { pageAs, U, api } from '../helpers.js';

const SCREENS = ['overview', 'actions', 'setup', 'set', 'register', 'classify', 'counsel', 'findings', 'review', 'outputs', 'reference'];

test('worked example: every screen and every output opens without errors', async ({ browser }) => {
  const page = await pageAs(browser, U.assessor);
  // On a fresh database the start screen offers the example; once an assessment exists it is in the menu.
  if (await page.locator('main [data-act="example"]').count()) await page.click('main [data-act="example"]');
  else { await page.click('header [data-act="drawer"]'); await page.click('.drawer [data-act="example"]'); }
  for (const s of SCREENS) { await page.evaluate(s => window.AUA.go(s), s); await page.waitForTimeout(150); }
  await page.evaluate(() => window.AUA.go('outputs'));
  const n = await page.locator('.outrow').count();
  expect(n).toBe(12);
  for (let i = 0; i < n; i++) { await page.locator('.outrow').nth(i).click(); await expect(page.locator('#out-back')).toBeVisible(); await page.click('#out-back'); }
  expect(page._errors).toEqual([]);
});

test('the method owner starts the assessment; everyone can open every screen', async ({ browser }) => {
  const mo = await pageAs(browser, U.mo);
  if (!(await api('GET', '/api/engagement', undefined, U.mo)).body.exists) {
    await mo.click('[data-act="new"]');
    await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
  }
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

test('demo: the three-app introduction opens first, and Switch app reopens it', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': U.counsel }, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); await page.goto('/'); await page.waitForTimeout(800);
  const dlg = page.getByRole('dialog', { name: 'From what the law expects to evidence each AI use fits' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('link', { name: /Open Obligations Atlas/ })).toHaveAttribute('href', /obligations-atlas\.triodian\.com\/\?suite=1/);
  await page.keyboard.press('Escape'); await expect(dlg).toBeHidden();
  await page.reload(); await page.waitForTimeout(500); await expect(dlg).toBeHidden();
  await page.getByRole('button', { name: /Switch app/ }).click(); await expect(dlg).toBeVisible();
  await ctx.close();
});
