// Reading the calibration set from the AI Risk Appetite app through the APPETITE service binding (plan task 1B.4).
// Run: node tests/service-binding.test.mjs
import { calibrationReader } from '../src/worker.js';
import { readFileSync } from 'node:fs';
let fails = 0; const check = (n, ok, extra) => { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (extra ? ' → ' + extra : '')); if (!ok) fails++; };
const set = { schema: 'triodian.calibration.v1' };

let read = calibrationReader({ APPETITE: { calibrationSet: async () => ({ status: 200, body: { version: 2, status: 'approved', calibrationSet: set } }) } });
let r = await read();
check('the binding returns the set, with no secret set', r.version === 2 && r.calibrationSet.schema === set.schema);
read = calibrationReader({ APPETITE: { calibrationSet: async () => ({ status: 404, body: { error: 'No calibration set has been issued yet.' } }) } });
r = await read();
check('the app’s refusal is passed on', r.status === 404 && /No calibration set/.test(r.error));
read = calibrationReader({ APPETITE: { calibrationSet: async () => { throw new Error('no such entrypoint'); } } });
r = await read();
check('an unreachable binding says what to check', r.status === 503 && /APPETITE service binding/.test(r.error));
check('no binding and no token: no link', calibrationReader({}) === null);
check('the binding wins over the older token', calibrationReader({ APPETITE: { calibrationSet: async () => ({}) }, APPETITE_URL: 'https://x', APPETITE_CLIENT_ID: 'a', APPETITE_CLIENT_SECRET: 'b' }).toString().includes('calibrationSet'));
const w = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const svc = [...w.matchAll(/"services": \[\{ "binding": "APPETITE", "service": "([^"]+)", "entrypoint": "AppetiteService" \}\]/g)].map(m => m[1]);
check('each environment binds to its own Risk Appetite Worker', svc.join() === 'risk-appetite,risk-appetite-test,risk-appetite-client', svc.join());
check('no secret or URL for the link in wrangler.jsonc', !/"APPETITE_(URL|CLIENT_ID|CLIENT_SECRET)":/.test(w));
console.log(fails ? `\n${fails} failed` : '\nAll passed'); process.exit(fails ? 1 : 0);
