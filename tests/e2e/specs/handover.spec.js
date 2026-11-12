// The hand-over (development plan tasks 7.1, 7.4 part A and 7.5). The technology owner and the AI governance team
// supply the inventory and the evidence and confirm it complete. They see the hand-over only, and change nothing after it.
import { test, expect } from '@playwright/test';
import { pageAs, U, api, editAs } from '../helpers.js';

async function ensureAssessment(browser) {
  if ((await api('GET', '/api/engagement', undefined, U.mo)).body.exists) return;
  const mo = await pageAs(browser, U.mo);
  await mo.click('[data-act="new"]');
  await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
  await mo.context().close();
}

test('Admin refuses a second technology owner, and a supplier as the independent reviewer', async ({ browser }) => {
  await ensureAssessment(browser);
  const second = await api('POST', '/api/admin/users', { email: 'cio2@ua.test', name: 'Second CIO', organisation: 'Test', roles: ['technologyOwner'], isAdmin: false, active: true });
  expect(second.status).toBe(400); expect(second.body.error).toContain('already holds the role Technology owner');
  const both = await api('POST', '/api/admin/users', { email: 'both@ua.test', name: 'Both', organisation: 'Test', roles: ['ir', 'aiGovernance'], isAdmin: false, active: true });
  expect(both.status).toBe(400); expect(both.body.error).toContain('cannot be the independent reviewer');
});

test('a person with only a management role is sent the hand-over and nothing else', async ({ browser }) => {
  await ensureAssessment(browser);
  const me = (await api('GET', '/api/me', undefined, U.aiGovernance)).body;
  expect(me.handoverOnly).toBe(true);
  const e = (await api('GET', '/api/engagement', undefined, U.aiGovernance)).body;
  expect(e.handoverOnly).toBe(true);
  expect(Object.keys(e.data).sort()).toEqual(['closed', 'engagement', 'handover', 'liaison', 'people', 'schema']);
  for (const [m, path] of [['GET', '/api/archive'], ['GET', '/api/evidence'], ['GET', '/api/appetite-feedback'], ['GET', '/api/admin/users']]) expect((await api(m, path, undefined, U.aiGovernance)).status).toBe(403);
  const put = await api('PUT', '/api/engagement', { revision: e.revision, data: { schema: 'triodian.aua.v1', engagement: { id: 'x' } } }, U.technologyOwner);
  expect(put.status).toBe(403);
  // everyone else is sent the assessment as before
  expect((await api('GET', '/api/engagement', undefined, U.owner)).body.data.schema).toBe('triodian.aua.v1');
});

test('the team supplies the hand-over, the technology owner confirms it complete, and counsel reopens it', async ({ browser }) => {
  await ensureAssessment(browser);
  // counsel asks for it, from set-up
  const co = await pageAs(browser, U.counsel);
  await co.locator('nav.steps [data-act="go"][data-to="setup"]').first().click();
  await expect(co.locator('#handover #ho_status')).toContainText('Not started');
  await co.locator('#ho_note').fill('The AI inventory and the provider contracts, by Friday.');
  await co.click('[data-ho="request"]');
  await expect(co.locator('#toast')).toContainText('asked for');
  expect(co._errors).toEqual([]);
  await co.context().close();

  // a member of the team adds two items; they see the one screen
  const ag = await pageAs(browser, U.aiGovernance);
  await expect(ag.locator('h1')).toHaveText('Your hand-over');
  await expect(ag.locator('nav.steps')).toHaveCount(0);
  await expect(ag.locator('body')).toContainText('The AI inventory and the provider contracts, by Friday.');
  const add = async (p, kind, system, description, where) => { await p.selectOption('#ho_kind', kind); await p.fill('#ho_system', system); await p.fill('#ho_description', description); await p.fill('#ho_where', where); await p.click('[data-ho="save"]'); await expect(p.locator('#toast')).toContainText('Saved to the hand-over'); };
  await add(ag, 'inventory', 'Claims triage model at the claims manager', 'Routes motor claims', 'Inventory row 14');
  await add(ag, 'evidence', 'Outside claims manager', 'Claims management agreement', 'Contracts system C-1182');
  await expect(ag.locator('#ho_status')).toContainText('2 items supplied');
  await expect(ag.locator('table')).toContainText('aiGovernance (test)');
  expect(ag._errors).toEqual([]);
  await ag.context().close();

  // the technology owner adds existing assurance and confirms it complete, with a second click
  const cio = await pageAs(browser, U.technologyOwner);
  await add(cio, 'assurance', 'Outside claims manager', 'Internal audit covers payment controls only', 'IA-2026-07');
  await cio.click('[data-ho="complete"]'); await cio.click('[data-ho="complete"]');
  await expect(cio.locator('#ho_status')).toContainText('Confirmed complete by technologyOwner (test)');
  await expect(cio.locator('#ho_system')).toHaveCount(0);            // nothing more to change
  await expect(cio.locator('[data-ho="edit"]')).toHaveCount(0);
  expect(cio._errors).toEqual([]);
  await cio.context().close();
  expect((await api('PUT', '/api/handover', { action: 'item', kind: 'inventory', system: 'Late one' }, U.aiGovernance2)).status).toBe(409);
  expect((await api('PUT', '/api/handover', { action: 'reopen', reason: 'More' }, U.aiGovernance2)).status).toBe(403);

  // the assessor sees what was handed over; an ordinary save cannot change it
  const stored = (await api('GET', '/api/engagement', undefined, U.assessor)).body.data.handover;
  expect(stored.items.length).toBe(3); expect(stored.complete.by).toBeTruthy();
  const save = await editAs(U.mo, d => { d.handover.items = []; d.engagement.reference = 'HO-1'; });
  expect(save.status).toBe(200);
  expect((await api('GET', '/api/engagement', undefined, U.mo)).body.data.handover.items.length).toBe(3);

  // counsel reopens it with the reason; the team can add again
  const co2 = await pageAs(browser, U.counsel);
  await co2.locator('nav.steps [data-act="go"][data-to="setup"]').first().click();
  await expect(co2.locator('#handover')).toContainText('Claims triage model at the claims manager');
  await co2.locator('#ho_reason').fill('The binder renewal papers are still to come');
  await co2.click('[data-ho="reopen"]');
  await expect(co2.locator('#handover #ho_status')).toContainText('3 items supplied, not yet confirmed complete');
  expect(co2._errors).toEqual([]);
  await co2.context().close();
  expect((await api('PUT', '/api/handover', { action: 'item', kind: 'evidence', system: 'Binder', description: 'Renewal papers' }, U.aiGovernance2)).status).toBe(200);
  // someone who supplied the hand-over cannot later be made the independent reviewer
  const users = (await api('GET', '/api/admin/users')).body.users, sup = users.find(u => u.email === U.aiGovernance2);
  const r = await api('PUT', '/api/admin/users/' + sup.id, { email: sup.email, name: sup.name, organisation: sup.organisation, roles: ['ir'], isAdmin: false, active: true });
  expect(r.status).toBe(400); expect(r.body.error).toContain('supplied or confirmed the hand-over');
});

test('the worked example shows the hand-over in set-up, with who supplied each item', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': U.mo }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('/');
  await expect(p.locator('.examplenote', { hasText: 'Worked example:' })).toBeVisible({ timeout: 15_000 });
  await p.locator('nav.steps [data-act="go"][data-to="setup"]').first().click();
  await expect(p.locator('#handover #ho_status')).toContainText('Confirmed complete by Imogen Hart');
  await expect(p.locator('#handover')).toContainText('Tobias Reed');
  await expect(p.locator('#handover')).toContainText('It does not cover the triage model.');
  await expect(p.locator('#handover [data-ho]')).toHaveCount(0);
  expect(errs).toEqual([]);
  await ctx.close();
});
