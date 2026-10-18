// Cloudflare Worker entry point for the AI Use Assessment app.
// Static files in /public (the app, /admin and /profile) are served by Cloudflare. Requests to /api/* come here.
// All the app logic is in lib/core (cloud-neutral); this file only connects it to Cloudflare:
//   identity  → lib/identity/cloudflare-access.js (Cloudflare Access sign-in)
//   storage   → lib/store/d1.js (Cloudflare D1)
//   calibration → the AI Risk Appetite app's /api/calibration-set, read with a Cloudflare Access service token
//   email     → Cloudflare Email Service binding EMAIL, only when NOTIFY_SENDING is "on" (off by default)
import { identify } from '../lib/identity/cloudflare-access.js';
import { d1Store } from '../lib/store/d1.js';
import { handle } from '../lib/core/api.js';
import { dueReminders, deliver } from '../lib/core/notify.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

/** Reads the issued calibration set from the Risk Appetite app, or null while that link is not configured. */
function calibrationReader(env) {
  if (!env.APPETITE_URL || !env.APPETITE_CLIENT_ID || !env.APPETITE_CLIENT_SECRET) return null;
  return async () => {
    const r = await fetch(env.APPETITE_URL.replace(/\/$/, '') + '/api/calibration-set', {
      headers: { 'CF-Access-Client-Id': env.APPETITE_CLIENT_ID, 'CF-Access-Client-Secret': env.APPETITE_CLIENT_SECRET, Accept: 'application/json' },
      redirect: 'manual',
    });
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch (e) { /* not JSON: usually the Access sign-in page */ }
    if (!r.ok || !body) return { status: r.status, error: body && body.error ? body.error : `The Risk Appetite app answered ${r.status}. Check the service token and its policy.` };
    return body;
  };
}

/** Returns a function that emails one message, or null while sending is switched off. */
function emailSender(env) {
  if (env.NOTIFY_SENDING !== 'on' || !env.EMAIL || !env.NOTIFY_FROM) return null;
  return m => env.EMAIL.send({ to: m.to, from: { email: env.NOTIFY_FROM, name: 'AI Use Assessment' }, subject: m.subject, text: m.text });
}
const siteUrl = (env, request) => env.SITE_URL || (request ? new URL(request.url).origin : 'https://use-assessment.triodian.com');

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const who = await identify(request, env);
    if (!who.email) return json({ error: who.error }, who.status || 401);
    if (!env.DB) return json({ error: 'The database is not connected to this site yet.' }, 503);

    try {
      const r = await handle({
        method: request.method, path: url.pathname, email: who.email, text: () => request.text(),
        site: env.SITE_LABEL || '', readCalibration: calibrationReader(env),
        linkMissing: ['APPETITE_URL', 'APPETITE_CLIENT_ID', 'APPETITE_CLIENT_SECRET'].filter(k => !env[k]),
        origin: siteUrl(env, request), sender: emailSender(env), defer: p => ctx.waitUntil(p),
      }, d1Store(env.DB));
      return json(r.body, r.status);
    } catch (e) {
      console.error(e);
      return json({ error: 'The server hit an error. Try again.' }, 500);
    }
  },

  // Daily: remind counsel about questions open for a week or more.
  async scheduled(event, env, ctx) {
    if (!env.DB) return;
    const store = d1Store(env.DB);
    ctx.waitUntil((async () => {
      await store.init();
      const e = await store.getEngagement(); if (!e) return;
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: env.REMINDER_TZ || 'Australia/Brisbane' }).format(new Date());
      await deliver(dueReminders(e.data, await store.listUsers(), today, siteUrl(env)), store, emailSender(env), new Date().toISOString());
    })());
  },
};
