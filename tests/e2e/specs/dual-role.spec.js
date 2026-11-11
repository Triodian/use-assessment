// The GC also acts as counsel (development plan task 0.5), tried in the worked example: the method owner turns the
// setting on and names a second approver; the R1 card then asks for the second approver's agreement, not counsel's.
import { test, expect } from '@playwright/test';
import { ADMIN } from '../helpers.js';

test('the GC-also-counsel setting names a second approver, and R1 asks for that agreement', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('/');
  await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  await p.selectOption('#who-hdr', 'p4');   // Sam Okoro, the method owner in the example
  await p.locator('nav.steps [data-act="go"][data-to="setup"]').first().click();
  await p.locator('#e-gcac').check();
  await expect(p.locator('body')).toContainText('No one has the second approver role yet');
  // give the claims or deal executive (p3) the second approver role, then name them
  await p.locator('[id^="role-2-executive"], input[data-arrchk="people.2.roles"][value="executive"]').first().check();
  await p.selectOption('[data-path="engagement.secondApproverId"]', 'p3');
  await p.locator('nav.steps [data-act="go"][data-to="set"]').first().click();
  await expect(p.locator('body')).toContainText('The GC also acts as counsel, so the GC and the second approver named in set-up each record their own agreement.');
  expect(errs).toEqual([]);
  await ctx.close();
});
