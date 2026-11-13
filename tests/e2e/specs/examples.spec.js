// Worked examples by sector. Triodian Start opens the app on one with ?example=<sector>; the choice holds for the
// browser session, and the menu offers the other. The superannuation example (Coastline Super, fictional) is the same
// fund as the worked examples in AI Board Direction and AI Risk Appetite: it uses the superannuation trustee pack and
// the calibration set the board approved in the Risk Appetite example.
import { test, expect } from '@playwright/test';
import { ADMIN } from '../helpers.js';

async function start(browser, path) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Dev-User': ADMIN }, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('triodian.suite.seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(path);
  await expect(p.locator('.examplenote', { hasText: 'Worked example:' }).first()).toBeVisible({ timeout: 15_000 });
  return { ctx, p };
}
const facts = p => p.evaluate(() => { const S = window.AUA.state, f = id => window.AUA.finding(id);
  return { name: S.engagement.insurer, pack: S.engagement.sectorPack, cal: S.calibration && S.calibration.loaded ? S.calibration.status + ' v' + S.calibration.version : 'none', minute: (S.calibration || {}).minuteRef || '',
    people: S.people.map(x => x.name), fns: S.arrangements.map(a => a.function), findings: S.arrangements.map(a => { const x = f(a.id); return x.type || x.label; }),
    broken: window.AUA.broken().length, hits: window.AUA.hits().length, diff: S.diffReports.length, docs: S.documents.filter(d => d.id === 'D6').map(d => d.title)[0],
    tiers: S.entries.map(e => (e.fields[15] || {}).value || ''), update: S.liaison.updates[0].rows.length, includeLegal: S.liaison.updates[0].includeLegal, handover: S.handover.items.length }; });

test('?example=superannuation opens Coastline Super with the super pack and the board’s approved appetite', async ({ browser }) => {
  const { ctx, p } = await start(browser, '/?example=superannuation');
  await expect(p.locator('.examplenote').first()).toContainText('a fictional superannuation trustee, Coastline Super');
  await expect(p).toHaveURL(/\/(#.*)?$/);                          // the parameter is tidied away
  await p.goto('/?other=1&example=superannuation');                // only its own parameter is removed, so the suite's stays for the suite to read
  await expect(p).toHaveURL(/\/\?other=1(#.*)?$/);
  await expect(p.locator('.examplenote', { hasText: 'Coastline Super' }).first()).toBeVisible({ timeout: 15_000 });
  const s = await facts(p);
  expect(s.name).toBe('Coastline Super (fictional)'); expect(s.pack).toBe('superTrustee');
  expect(s.cal).toBe('approved v1'); expect(s.minute).toBe('Board minute 2026/11-07');   // the set the Risk Appetite example approves
  expect(s.diff).toBe(0);                                          // loaded before anything was classified
  expect(s.fns).toEqual(['Claims and group insurance', 'Member services and communications', 'Administration and payments']);
  expect(s.findings).toEqual(['Awaiting counsel', 'F1', 'F4']);
  expect(s.tiers).toEqual(['A3', '', 'A1', '']);
  expect(s.people).toEqual(expect.arrayContaining(['Mei-Lin Zhou', 'Callum Brandt', 'Farah Idris', 'Anjali Deshmukh', 'Rohan Castellano']));
  expect(s.docs).toContain('Administration agreement and group insurance policy');
  expect(s.broken).toBe(0); expect(s.hits).toBe(2);              // the same two fixed-text phrases the insurer example flags
  expect(s.handover).toBe(6); expect(s.update).toBeGreaterThan(0); expect(s.includeLegal).toBe(false);
  // the expected rung comes from the fund's appetite (A3 × C4 is E3), and the provider's A3 sits at the ceiling, not over it
  const e1 = await p.evaluate(() => { const S = window.AUA.state; window.AUA.go('register'); return S.entries[0].id; });
  await expect(p.locator('body')).toContainText('Claims triage model');
  await expect(p.locator('body')).not.toContainText('Corvane');
  await expect(p.locator('body')).not.toContainText('Above ceiling ·');
  expect(e1).toBe('REG-001');
  // each screen opens without an error and in the pack's words
  for (const scr of ['overview', 'setup', 'classify', 'counsel', 'findings', 'outputs']) {
    const ok = await p.evaluate(x => { try { window.AUA.go(x); return true; } catch (e) { return String(e); } }, scr);
    expect(ok).toBe(true);
  }
  await expect(p.locator('body')).not.toContainText('policyholder');
  // acting as the technology owner shows the hand-over and what counsel released, and nothing else
  await p.evaluate(() => window.AUA.go('overview'));
  await p.locator('#who, [data-act="person"]').first().selectOption('p11');
  await expect(p.locator('body')).toContainText('You are acting as Mei-Lin Zhou');
  await expect(p.locator('body')).toContainText('Claims triage model at Southgate Group Life');
  // the choice holds on a plain reload
  await p.goto('/');
  await expect(p.locator('.examplenote', { hasText: 'Coastline Super' }).first()).toBeVisible({ timeout: 15_000 });
  expect(p._errors).toEqual([]);
  await ctx.close();
});

test('the default is the insurer example; the menu switches between them, each with its own pack', async ({ browser }) => {
  const { ctx, p } = await start(browser, '/');
  await expect(p.locator('.examplenote').first()).toContainText('a fictional insurer, Corvane');
  let s = await facts(p);
  expect(s.pack).toBe('generalInsurer'); expect(s.cal).toBe('none');
  await p.click('header [data-act="drawer"]');
  await expect(p.locator('.drawer [data-act="example"][data-ex="insurance"]')).toHaveCount(0);   // already open
  await p.locator('.drawer [data-act="example"][data-ex="superannuation"]').click();
  await expect(p.locator('.examplenote').first()).toContainText('Coastline Super');
  expect((await facts(p)).pack).toBe('superTrustee');
  await p.click('header [data-act="drawer"]');
  await p.locator('.drawer [data-act="example"][data-ex="insurance"]').click();
  await expect(p.locator('.examplenote').first()).toContainText('Corvane');
  s = await facts(p);
  expect(s.name).toBe('Corvane General Insurance (fictional)'); expect(s.pack).toBe('generalInsurer'); expect(s.cal).toBe('none');   // the insurer example is as it was
  expect(s.fns).toEqual(['Claims', 'Legal and compliance', 'Underwriting and pricing']);
  // a sector this app has no example for opens the first
  await p.goto('/?example=unregulated');
  await expect(p.locator('.examplenote').first()).toContainText('Corvane');
  expect(p._errors).toEqual([]);
  await ctx.close();
});

test('?example=banking opens Wattlebrook Bank with the ADI pack and the board’s approved appetite', async ({ browser }) => {
  const { ctx, p } = await start(browser, '/?example=banking');
  await expect(p.locator('.examplenote').first()).toContainText('a fictional bank, Wattlebrook Bank');
  const s = await facts(p);
  expect(s.name).toBe('Wattlebrook Bank (fictional)'); expect(s.pack).toBe('adi');
  expect(s.cal).toBe('approved v1'); expect(s.minute).toBe('Board minute 2026/11-09');   // the set the Risk Appetite example approves
  expect(s.diff).toBe(0);
  expect(s.fns).toEqual(['Financial crime (AML/CTF, fraud and scams)', 'Customer service and complaints', 'Collections and financial hardship']);
  expect(s.findings).toEqual(['Awaiting counsel', 'F1', 'F4']);
  expect(s.tiers).toEqual(['A3', '', 'A1', '']);
  expect(s.people).toEqual(expect.arrayContaining(['Naomi Fitzgerald', 'Dylan Kruger', 'Sana Malik', 'Leila Haddad', 'Thomas Achterberg']));
  expect(s.docs).toContain('Credit and lending delegations');
  expect(s.broken).toBe(0);
  expect(s.handover).toBe(6); expect(s.update).toBeGreaterThan(0); expect(s.includeLegal).toBe(false);
  await p.evaluate(() => window.AUA.go('register'));
  await expect(p.locator('body')).toContainText('Scam screening model');
  await expect(p.locator('body')).toContainText('E3 Event notification');          // the expected rung, from the bank's appetite
  await expect(p.locator('body')).not.toContainText('Coastline');
  await expect(p.locator('body')).not.toContainText('Above ceiling ·');
  for (const scr of ['overview', 'setup', 'classify', 'counsel', 'findings', 'outputs']) expect(await p.evaluate(x => { try { window.AUA.go(x); return true; } catch (e) { return String(e); } }, scr)).toBe(true);
  await p.evaluate(() => window.AUA.go('overview'));
  await p.locator('#who, [data-act="person"]').first().selectOption('p11');
  await expect(p.locator('body')).toContainText('You are acting as Naomi Fitzgerald');
  await expect(p.locator('body')).toContainText('Scam screening model at Ironbark Payments');
  expect(p._errors).toEqual([]);
  await ctx.close();
});
