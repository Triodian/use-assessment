// Jurisdiction overlays (development plan task US.4; the Metamodel's adding-a-jurisdiction, step J.4): each US main
// sector has a pack built on its baseline, with the document list and the main arrangement type a US entity in the
// sector has. A US matter brief names its jurisdiction. Run: node tests/overlays.test.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../public/shared/packs.js');

let fails = 0; const ok = (label, cond, extra) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + ' · ' + label + (extra ? ' → ' + extra : '')); };
globalThis.window = {}; eval(readFileSync(new URL('../public/aua-content.js', import.meta.url), 'utf8')); const B = window.AUA_CONTENT;
const O = JSON.parse(readFileSync(new URL('../content/overlays/us.json', import.meta.url), 'utf8'));
const us = Object.values(B.packs).filter(p => p.overlay === 'US');

ok('five US packs', us.length === 5, us.map(p => p.id).join());
for (const o of O.packs) {
  const p = B.packs[o.id], r = P.resolve(B, o.id), rb = P.resolve(B, o.builtOn);
  ok(`${o.id}: built on ${o.builtOn}, not itself a baseline`, p && !p.baseline && p.builtOn === B.packs[o.builtOn].baseline);
  ok(`${o.id}: ten documents, the overlay ones renamed in the list and the framework table`, r.documents.length === 10 && Object.entries(o.documents).every(([ref, name]) => r.documents.find(d => d.ref === ref).name === name && r.frameworkMarkdown.includes(`| ${ref} | ${name} |`)));
  ok(`${o.id}: the other documents are the baseline's`, r.documents.filter(d => !o.documents[d.ref]).every(d => d.name === rb.documents.find(x => x.ref === d.ref).name));
  ok(`${o.id}: the main arrangement type is the US one, filled`, r.boundaries[0].parties === P.fill(o.arrangement, p.nouns) && !/\{/.test(r.boundaries[0].parties));
  ok(`${o.id}: the other boundaries are the baseline's`, r.boundaries.slice(1).every((b, i) => b.parties === rb.boundaries[i + 1].parties));
  ok(`${o.id}: no token left unfilled`, !P.unfilled(r).length, P.unfilled(r).join());
  ok(`${o.id}: the note says counsel decides what applies`, /counsel's question/.test(p.note));
  ok(`${o.id}: no "must" or "required" in the overlay's words`, !/\b(must|required)\b/i.test(JSON.stringify(o)));
}
const src = readFileSync(new URL('../public/aua.js', import.meta.url), 'utf8');
const names = JSON.parse(src.slice(src.indexOf('const BRIEF_NAMES = ') + 20, src.indexOf(';', src.indexOf('const BRIEF_NAMES = '))));
ok('a US matter brief names the United States', names.jurisdictions.US === 'United States');
ok('entity type labels name no jurisdiction', ['bank', 'insurer', 'capitalMarketsIntermediary', 'financialInstitution'].every(k => !/Singapore|MAS/.test(names.entityTypes[k])));

console.log(fails ? `\n${fails} failed` : '\nAll passed');
process.exit(fails ? 1 : 0);
