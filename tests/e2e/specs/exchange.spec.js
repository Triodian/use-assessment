// The files AI Use Assessment writes and reads conform to the published exchange schemas (Triodian_Metamodel
// exchange/, vendored in vendor/exchange by tools/sync-exchange.mjs; development plan task R.4).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ADMIN } from '../helpers.js';
import { exchangeErrors, fixture } from '../exchange.js';

test('writes: the register extract v1 and the in-use feed v2, from the worked example', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto('/');
  await expect(p.locator('.examplebar', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  const x = await p.evaluate(() => ({ v1: window.AUA.extract(), v2: window.AUA.extractV2() }));
  expect(exchangeErrors('register-extract-v1.schema.json', x.v1)).toEqual([]);
  expect(exchangeErrors('register-extract-v2.schema.json', x.v2)).toEqual([]);
  // and with the calibration set loaded, so the measures that need it are counted
  const y = await p.evaluate((cal) => { window.AUA.loadCalibration(cal, true); return window.AUA.extractV2(); }, fixture('calibration-set.json'));
  expect(y.measures.find(m => m.ref === 'M1').value).not.toBeNull();
  expect(exchangeErrors('register-extract-v2.schema.json', y)).toEqual([]);
  await ctx.close();
});

test('reads: the calibration set and the matter brief it is tested with conform', () => {
  expect(exchangeErrors('calibration-set-v1.schema.json', fixture('calibration-set.json'))).toEqual([]);
  expect(exchangeErrors('matter-brief-v1.schema.json', JSON.parse(readFileSync(new URL('../../fixtures/matter-brief-au-general-insurer.json', import.meta.url), 'utf8')))).toEqual([]);
});
