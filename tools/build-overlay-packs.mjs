// Writes a sector pack for each jurisdiction overlay in content/overlays/*.json to content/packs/<id>.json
// (development plan task US.4; the Metamodel's docs/adding-a-jurisdiction.md, step J.4). Each starts from its
// best-practice baseline pack; the overlay names the documents a US entity in the sector usually holds (D1 to D10, in
// the list and in the framework text's table) and its main arrangement type (the first boundary's parties).
// Run after build-baseline-packs: node tools/build-overlay-packs.mjs && node tools/build-content.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const Packs = createRequire(import.meta.url)('../public/shared/packs.js');
const at = p => new URL('../' + p, import.meta.url);
const content = JSON.parse(readFileSync(at('public/aua-content.json'), 'utf8'));
const deep = o => JSON.parse(JSON.stringify(o));
const built = [];
for (const f of readdirSync(at('content/overlays')).filter(f => f.endsWith('.json')).sort()) {
  const O = JSON.parse(readFileSync(at('content/overlays/' + f), 'utf8'));
  const where = O.jurisdiction === 'US' ? 'the United States' : O.jurisdiction;
  for (const o of O.packs) {
    const base = JSON.parse(readFileSync(at(`content/packs/${o.builtOn}.json`), 'utf8'));
    if (!base.baseline) throw new Error(`${o.id}: ${o.builtOn} is not a baseline pack`);
    const pack = deep(base);
    pack.id = o.id; pack.name = o.name; pack.jurisdiction = O.jurisdiction; pack.entityTypes = [];
    delete pack.baseline; pack.builtOn = base.baseline; pack.overlay = O.jurisdiction;
    pack.note = `Generated from content/overlays/${f} and the ${base.name} pack by tools/build-overlay-packs.mjs; do not edit by hand. The ${base.name.replace(/ \(best-practice baseline\)$/, '').toLowerCase()} baseline for ${where}: the documents and the main arrangement type draw on ${o.instruments}. Whether any of them applies is counsel's question; the matter brief lists the records.`;
    // The framework text as the baseline's edits leave it, tokens unfilled: edits are applied before the nouns.
    const md = (Packs.resolve({ ...content, packs: { [base.id]: { ...base, nouns: {} } } }, base.id).frameworkMarkdown || '').split('\n');
    for (const [ref, name] of Object.entries(o.documents || {})) {
      const d = pack.replace.documents.find(x => x.ref === ref);
      if (!d) throw new Error(`${o.id}: no document ${ref} in ${o.builtOn}`);
      d.name = name;
      const row = md.find(l => l.startsWith(`| ${ref} | `));
      if (!row) throw new Error(`${o.id}: no ${ref} row in the framework text`);
      const cells = row.split(' | '); cells[1] = name;
      pack.edits = (pack.edits || []).concat({ at: 'frameworkMarkdown', find: row, replace: cells.join(' | ') });
    }
    if (o.arrangement) pack.override['boundaries.0.parties'] = o.arrangement;
    writeFileSync(at(`content/packs/${o.id}.json`), JSON.stringify(pack, null, 2) + '\n');
    built.push(o.id);
  }
}
console.log(`${built.length} overlay packs: ${built.join(', ')}`);
