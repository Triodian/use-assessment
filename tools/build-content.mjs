// Builds public/aua-content.js from public/aua-content.json and the sector packs in content/packs/*.json, so the page loads
// the content without a fetch (development plan task 3.2). Change wording in those files, then run:
//   node tools/build-content.mjs
// It refuses to write when a pack leaves a {token} unfilled or misses a noun another pack names.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Packs = require('../public/shared/packs.js');
// The parts every pack in this app replaces whole.
const WHOLE = ['documents'];
const at = (p) => new URL('../' + p, import.meta.url);

const base = JSON.parse(readFileSync(at('public/aua-content.json'), 'utf8'));
const packs = {};
for (const f of readdirSync(at('content/packs')).filter(f => f.endsWith('.json')).sort()) {
  const p = JSON.parse(readFileSync(at('content/packs/' + f), 'utf8'));
  if (p.id + '.json' !== f) throw new Error(`${f}: its id is ${p.id}`);
  const missing = Packs.NOUNS.filter(n => !(p.nouns && typeof p.nouns[n] === 'string'));
  if (missing.length) throw new Error(`${f}: nouns missing: ${missing.join(', ')}`);
  for (const k of WHOLE) if (!Array.isArray((p.replace || {})[k]) || !p.replace[k].length) throw new Error(`${f}: replace.${k} missing`);
  packs[p.id] = p;
}
if (!packs[Packs.DEFAULT]) throw new Error(`The ${Packs.DEFAULT} pack is missing`);
const built = { ...base, packs };
for (const id of Object.keys(packs)) {
  const left = Packs.unfilled(Packs.resolve(built, id));
  if (left.length) throw new Error(`${id}: unfilled tokens: ${left.join(', ')}`);
}
writeFileSync(at('public/aua-content.js'), '/* Generated from aua-content.json and content/packs by tools/build-content.mjs. Do not edit. */\nwindow.AUA_CONTENT = ' + JSON.stringify(built) + ';\n');
console.log(`aua-content.js written: ${Object.keys(packs).length} pack(s): ${Object.keys(packs).join(', ')}`);
