// Importing the client's provider register (development plan task R.1): a 50-row CSV with two malformed rows loads into
// a new assessment as arrangements and register entries, the bad rows refused with their reasons, and the client's ids
// come back out in the import format. The assessment is served from a stub; every save is captured.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { U } from '../helpers.js';

const FX = new URL('../../fixtures/provider-register.csv', import.meta.url).pathname;

test('the provider register loads into the register, refuses bad rows, and round-trips the ids', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': U.mo }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); sessionStorage.setItem('triodian.example.left', '1'); } catch (e) {} });
  let serve = null, rev = 0, last = null;
  await ctx.route('**/api/engagement', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: serve ? { exists: true, revision: rev, data: serve, people: [] } : { exists: false, revision: 0, people: [] } });
    serve = last = route.request().postDataJSON().data; rev += 1; return route.fulfill({ json: { revision: rev } });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('/'); await p.waitForTimeout(800);
  await p.locator('[data-act="new"]').first().click();
  await expect(p.locator('body')).toContainText('Set up the assessment'); // the new assessment opens on set-up once saved
  await expect.poll(() => rev).toBeGreaterThan(0);
  await p.evaluate(() => window.AUA.go('set'));
  await expect(p.locator('[data-act="importRegister"]')).toBeVisible();
  await p.setInputFiles('#registerIn', FX);
  await expect(p.locator('#toast')).toContainText('50 register entries imported into 7 new arrangements; 2 rows refused');
  await expect(p.locator('body')).toContainText('Line 28: no provider');
  await expect(p.locator('body')).toContainText('Line 29: Boundary "B9" is not one of B1, B2, B3');
  const st = await p.evaluate(() => { const S = window.AUA.state; return { arr: S.arrangements.map(a => a.externalId), ent: S.entries.length, e1: S.entries[0] }; });
  expect(st.arr).toEqual(['PR-0101', 'PR-0102', 'PR-0103', 'PR-0104', 'PR-0105', 'PR-0106', 'PR-0107']);
  expect(st.ent).toBe(50);
  expect(st.e1.externalId).toBe('AIS-001');
  expect(st.e1.fields[8]).toMatchObject({ value: 'Harbourline Administration Pty Ltd (fictional)', carried: true });
  expect(st.e1.fields[8].source).toContain('row 3 (PR-0101 · AIS-001)');
  expect(st.e1.fields[15]).toBeUndefined(); // tiers are the assessor's, not imported
  // loading the same file again adds nothing
  await p.setInputFiles('#registerIn', FX);
  await expect(p.locator('#toast')).toContainText('0 register entries imported; 50 already in the register');
  // the register back out in the import format keeps the client's ids
  const out = await p.evaluate(() => window.AUAImport.readArrangements(window.AUA.registerCsv()));
  expect(out.refused).toEqual([]);
  const src = await p.evaluate((t) => window.AUAImport.readArrangements(t).rows.map(r => [r.providerId, r.systemId, r.system]), readFileSync(FX, 'utf8'));
  expect(out.rows.map(r => [r.providerId, r.systemId, r.system])).toEqual(src);
  await expect.poll(() => last && last.entries.length).toBe(50);
  expect(errs).toEqual([]);
  await ctx.close();
});
