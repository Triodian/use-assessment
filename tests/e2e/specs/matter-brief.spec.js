// The matter brief from the AI Obligations Atlas (development plan task 2.6), tried in the worked example:
// set-up loads the brief and lists the obligations in scope by tier; the Counsel screen lists the brief's questions,
// and choosing one fills the new-question form, so it is raised against an arrangement and one of the seven questions.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN } from '../helpers.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/matter-brief-au-general-insurer.json');

test('set-up loads the matter brief; its questions are raised with counsel from the Counsel screen', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto('/');
  await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  await p.selectOption('#who-hdr', 'p4');   // Sam Okoro, the method owner in the example
  await p.locator('nav.steps [data-act="go"][data-to="setup"]').first().click();
  const card = p.locator('#briefCard');
  await expect(card).toContainText('No matter brief loaded.');

  // a file that is not a brief is refused with the reason
  await p.locator('[data-act="togglePaste"]').click();
  await p.fill('#brief_paste', '{"hello":1}');
  await p.locator('[data-act="pasteBrief"]').click();
  await expect(card).toContainText('it has no briefFormat');

  // the real brief
  await p.setInputFiles('#briefIn', FIXTURE);
  await expect(card).toContainText('General insurer');
  await expect(card).toContainText('OBL-AU-CPS230');
  await expect(card).toContainText(/preview data/i);
  await expect(card).toContainText('12 not yet raised');

  // Counsel: choose a question from the brief; the form is filled; add it
  await p.locator('nav.steps [data-act="go"][data-to="counsel"]').first().click();
  const qs = p.locator('#briefQs');
  await expect(qs).toContainText('12 of 12 questions not yet raised');
  const first = await qs.locator('li').first().innerText();
  const question = first.replace(/\s*Use this question\s*$/, '').trim();
  await qs.locator('[data-act="askBrief"]').first().click();
  await expect(p.locator('#ask-qq')).toHaveValue(question);
  await expect(p.locator('#ask-q7')).toHaveValue('7');
  await expect(p.locator('#ask-facts')).toHaveValue(/From the AI Obligations Atlas matter brief/);
  await p.locator('[data-act="addQ"]').click();
  await expect(qs).toContainText('11 of 12 questions not yet raised');
  await expect(p.locator('table.lg').first()).toContainText(question.slice(0, 60));

  // back in set-up the question shows as raised
  await p.locator('nav.steps [data-act="go"][data-to="setup"]').first().click();
  await expect(card).toContainText(/raised as QC-\d+/i);
  await expect(card).toContainText('11 not yet raised');
  expect(errs).toEqual([]);
  await ctx.close();
});
