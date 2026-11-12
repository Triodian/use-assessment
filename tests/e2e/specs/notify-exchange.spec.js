// Emails for the hand-over and for the updates and consultation that follow it (development plan task 7.4). Each step
// through the real routes writes a message for the right people, and no message carries what the step was about.
// Sending is off on this test server, so every message is held; an administrator sees them in Admin.
import { test, expect } from '@playwright/test';
import { pageAs, U, api, editAs } from '../helpers.js';

const MGMT = [U.aiGovernance, U.aiGovernance2, U.technologyOwner].sort();
const DIRECT = [U.counsel, U.delivery, U.gc, U.mo].sort();
const latest = async () => (await api('GET', '/api/admin/notifications')).body;
/** Runs one step and returns the messages it added: [{ to_email, subject, body, status }]. */
async function during(step) {
  const before = new Set((await latest()).entries.map(e => e.id));
  const r = await step();
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return (await latest()).entries.filter(e => !before.has(e.id));
}
const to = msgs => [...new Set(msgs.map(m => m.to_email))].sort();
const SECRET = ['Zephyr triage engine', 'pallet-forty-two', 'A3', 'Counsel finds no audit right', 'Thresholds are changed weekly'];
const clean = msgs => msgs.every(m => SECRET.every(x => !(m.subject + ' ' + m.body).includes(x)));

test('each step of the hand-over and the exchange tells the right people, and no email carries the content', async ({ browser }) => {
  if (!(await api('GET', '/api/engagement', undefined, U.mo)).body.exists) {
    const mo = await pageAs(browser, U.mo);
    await mo.click('[data-act="new"]');
    await expect(mo.locator('#savechip')).toHaveText(/Saved/, { timeout: 10_000 });
    await mo.context().close();
  }
  expect((await latest()).sending).toBe(false);
  const d0 = (await api('GET', '/api/engagement', undefined, U.mo)).body.data;
  if (d0.handover && d0.handover.complete && d0.handover.complete.by) expect((await api('PUT', '/api/handover', { action: 'reopen', reason: 'For the notification test' }, U.counsel)).status).toBe(200);

  // the hand-over
  let m = await during(() => api('PUT', '/api/handover', { action: 'request', note: 'Everything on the Zephyr triage engine, by Friday' }, U.counsel));
  expect(to(m)).toEqual(MGMT); expect(m[0].subject).toContain('The hand-over is asked for'); expect(m.every(x => x.status === 'held')).toBe(true); expect(clean(m)).toBe(true);
  m = await during(() => api('PUT', '/api/handover', { action: 'item', kind: 'inventory', system: 'Zephyr triage engine', description: 'Routes claims', where: 'pallet-forty-two' }, U.aiGovernance));
  expect(m).toEqual([]);                                   // adding an item tells no one
  m = await during(() => api('PUT', '/api/handover', { action: 'complete' }, U.technologyOwner));
  expect(to(m)).toEqual(DIRECT); expect(m[0].subject).toContain('The hand-over is confirmed complete'); expect(clean(m)).toBe(true);
  m = await during(() => api('PUT', '/api/handover', { action: 'reopen', reason: 'More on the Zephyr triage engine to come' }, U.counsel));
  expect(to(m)).toEqual(MGMT); expect(m[0].subject).toContain('The hand-over is open again'); expect(clean(m)).toBe(true);

  // an update, with counsel's determinations included: still nothing of it in the email
  const row = { entryId: 'REG-777', arrangement: 'Claims manager', system: 'Zephyr triage engine', tier: 'A3', consequence: 'C4', missing: ['Human involvement'], legal: [{ label: 'Rights held', value: 'Counsel finds no audit right' }] };
  m = await during(() => api('PUT', '/api/liaison', { action: 'release', stage: 'End of phase 3 · Classify and test', note: 'On the Zephyr triage engine', includeLegal: true, rows: [row] }, U.counsel));
  expect(to(m)).toEqual(MGMT); expect(m[0].subject).toContain('An update is released to you'); expect(clean(m)).toBe(true);
  const L = async () => (await api('GET', '/api/engagement', undefined, U.mo)).body.data.liaison;
  const uid = (await L()).updates.at(-1).id;

  // a contested point and its answer
  m = await during(() => api('PUT', '/api/liaison', { action: 'contest', updateId: uid, entryId: 'REG-777', reason: 'The Zephyr triage engine is not at A3', evidence: 'pallet-forty-two' }, U.aiGovernance));
  expect(to(m)).toEqual([U.assessor, U.mo].sort()); expect(m[0].subject).toContain('A point in an update is contested'); expect(clean(m)).toBe(true);
  const cid = (await L()).contests.at(-1).id;
  m = await during(() => api('PUT', '/api/liaison', { action: 'decide', id: cid, outcome: 'kept', decision: 'A3 stands for the Zephyr triage engine' }, U.assessor));
  expect(to(m)).toEqual(MGMT); expect(m[0].subject).toContain('A contested point is answered'); expect(clean(m)).toBe(true);

  // a consultation
  m = await during(() => api('PUT', '/api/liaison', { action: 'askConsultation', topic: 'Why the Zephyr triage engine is at A3' }, U.technologyOwner));
  expect(to(m)).toEqual(DIRECT); expect(m[0].subject).toContain('A consultation is asked for'); expect(clean(m)).toBe(true);
  const sid = (await L()).consultations.at(-1).id;
  m = await during(() => api('PUT', '/api/liaison', { action: 'holdConsultation', id: sid, heldOn: '2026-11-13', outcome: 'A3 explained for the Zephyr triage engine' }, U.delivery));
  expect(to(m)).toEqual(MGMT); expect(m[0].subject).toContain('A consultation is recorded as held'); expect(clean(m)).toBe(true);

  // facts to confirm
  m = await during(() => api('PUT', '/api/liaison', { action: 'askReview', facts: ['The Zephyr triage engine runs in Australia.'] }, U.counsel));
  expect(to(m)).toEqual(MGMT); expect(m[0].subject).toContain('Facts to confirm'); expect(clean(m)).toBe(true);
  const fid = (await L()).reviews.at(-1).facts[0].id;
  m = await during(() => api('PUT', '/api/liaison', { action: 'answerFact', id: fid, answer: 'incorrect', correction: 'Thresholds are changed weekly' }, U.aiGovernance2));
  expect(to(m)).toEqual([U.counsel]); expect(m[0].subject).toContain('A fact is answered'); expect(clean(m)).toBe(true);

  // a refused step writes nothing, and the person who acted is never told of their own step
  const before = (await latest()).entries.length;
  expect((await api('PUT', '/api/liaison', { action: 'release', stage: 'x', note: 'n' }, U.mo)).status).toBe(403);
  expect((await latest()).entries.length).toBe(before);
  // the two roles cannot read the messages held for others
  expect((await api('GET', '/api/admin/notifications', undefined, U.aiGovernance)).status).toBe(403);
});

test('a person who has turned emails off in their profile is not sent one', async () => {
  const off = await api('PUT', '/api/me/prefs', { notify: false }, U.aiGovernance2);
  expect(off.status, JSON.stringify(off.body)).toBe(200);
  const m = await during(() => api('PUT', '/api/handover', { action: 'request', note: 'Second request' }, U.counsel));
  expect(to(m)).toEqual([U.aiGovernance, U.technologyOwner].sort());
  expect((await api('PUT', '/api/me/prefs', { notify: true }, U.aiGovernance2)).status).toBe(200);
});
