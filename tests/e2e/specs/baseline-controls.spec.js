// Baseline controls (development plan task BP.5): agent controls on every use at A3 and above (BC1), and the evidence
// register cross-walked to the regimes in the matter brief (BC3), from the worked example.
import { test, expect } from '@playwright/test';
import { ADMIN } from '../helpers.js';

test('the worked example records agent controls at A3 and above, and gives the evidence register', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('/'); await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  const x = await p.evaluate(() => {
    const S = window.AUA.state, high = S.entries.filter(e => /^A[3-6]$/.test(((e.fields || {})[15] || {}).value || ''));
    return { high: high.map(e => ({ id: e.id, t: e.fields[15].value, c: e.agentControls || {} })), ac: window.AUA.output('AC'), er: window.AUA.output('ER') };
  });
  expect(x.high.length).toBeGreaterThan(0);
  for (const h of x.high) {
    for (const k of ['scope', 'log', 'stop']) expect(h.c[k], `${h.id} ${k}`).toBeTruthy();
    if (+h.t[1] >= 4) expect(h.c.checkpoint, `${h.id} checkpoint`).toBeTruthy();
  }
  expect(x.ac).toContain('# AC · Agent controls');
  expect(x.ac).toContain('All four controls are recorded for every entry at A3 and above.');
  expect(x.er).toContain('# ER · Evidence register, cross-walked');
  expect(x.er).toContain('recorded once');

  expect(errs).toEqual([]);
  await ctx.close();
});
