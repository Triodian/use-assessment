// Writes a sector pack for each best-practice baseline in the Triodian Metamodel (reference-data/baseline-profiles.json)
// to content/packs/bp*.json (development plan task BP.4; docs/baselines.md in the Metamodel). A baseline holds in any
// jurisdiction, so its pack starts from the jurisdiction-neutral financial-institution wording of the MAS pack, names
// no regulator, and gives examples that fit any sector (the insurance baseline keeps the insurance examples). The jurisdiction's own obligations come from the
// matter brief. Run: node tools/build-baseline-packs.mjs ../triodian_metamodel && node tools/build-content.mjs
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const mm = process.argv[2];
if (!mm) { console.error('Usage: node tools/build-baseline-packs.mjs <path to triodian_metamodel>'); process.exit(1); }
const at = p => new URL('../' + p, import.meta.url);
const profiles = JSON.parse(readFileSync(join(mm, 'reference-data/baseline-profiles.json'), 'utf8')).items;
const version = readFileSync(join(mm, 'VERSION'), 'utf8').trim();
const masFi = JSON.parse(readFileSync(at('content/packs/masFi.json'), 'utf8'));

// The nouns each baseline names. The regulator is never named: a baseline holds in any jurisdiction.
const N = (entity, an, customer, aCustomer, customers, harm, regulator) => ({
  entity, Entity: cap(entity), entities: plural(entity), Entities: cap(plural(entity)), anEntity: an, AnEntity: cap(an),
  customer, Customer: cap(customer), customers, Customers: cap(customers), aCustomer, ACustomer: cap(aCustomer),
  customerHarm: harm, regulator,
});
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function plural(s) { return /y$/.test(s) ? s.slice(0, -1) + 'ies' : s + 's'; }
const NOUNS = {
  'BP-BANKING': N('bank', 'a bank', 'customer', 'a customer', 'customers', 'A customer is wrongly declined, delayed, charged or paid, or blocked from their money.', 'the banking supervisor'),
  'BP-INSURANCE': N('insurer', 'an insurer', 'policyholder', 'a policyholder', 'policyholders', 'A policyholder is wrongly declined, delayed, charged or paid.', 'the insurance supervisor'),
  'BP-SECURITIES': N('firm', 'a firm', 'client', 'a client', 'clients', 'A client is given unsuitable advice, or an order or a payment goes wrong.', 'the securities regulator'),
  'BP-HEALTH': N('health care organisation', 'a health care organisation', 'patient', 'a patient', 'patients', 'A patient is wrongly denied, delayed or given unsafe care.', 'the health regulator'),
  'BP-PAYMENTS': N('payment provider', 'a payment provider', 'customer', 'a customer', 'customers', 'A customer’s payment is wrongly stopped, delayed or sent, or their account is closed in error.', 'the payments supervisor'),
  'BP-CI-GOVERNMENT': N('operator', 'an operator', 'customer', 'a customer', 'customers and the community', 'Customers or the community lose an essential service, or are put at risk.', 'the infrastructure regulator'),
  'BP-CI-CORPORATE': N('operator', 'an operator', 'customer', 'a customer', 'customers and the community', 'Customers or the community lose an essential service, or are put at risk.', 'the infrastructure regulator'),
  'BP-GOVERNMENT': N('agency', 'an agency', 'member of the public', 'a member of the public', 'members of the public', 'A person is wrongly refused, delayed or charged, or a decision about them cannot be explained.', 'the oversight body'),
};
// Words in the MAS pack that name Singapore's rules or a financial institution's records, made neutral.
const NEUTRAL = [
  [/under the MAS Guidelines on Outsourcing/g, 'under the outsourcing or third-party rules that apply to it'],
  [/Register of material outsourcing arrangements/g, 'Register of material service providers and outsourcing arrangements'],
  [/the recovery time objectives for the critical business services in the set/g, 'tolerance levels for the critical operations in the set'],
  [/the critical business service it supports, from the \{entity\}'s business continuity register/g, "the critical operation it supports, from the {entity}'s critical operations register"],
];
const neutral = s => NEUTRAL.reduce((t, [re, to]) => t.replace(re, to), s);
const deep = o => (typeof o === 'string' ? neutral(o) : Array.isArray(o) ? o.map(deep) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deep(v)])) : o);
// The authority examples A1 to A6 (MAS pack edits 2 to 7), for any sector.
const EXAMPLES = [
  'A member of staff uses a copilot to summarise a file',
  'A score or recommendation shown to a person who decides',
  'Automatic approval, decline or referral of a request',
  'A payment, price or allocation released with no person involved',
  'An agent that gathers documents, runs checks and books the next step',
  'An agent with write access to a system of record or to operational technology',
];
const FINANCIAL = new Set(['BP-BANKING', 'BP-SECURITIES', 'BP-PAYMENTS']);

for (const f of readdirSync(at('content/packs')).filter(f => /^bp[A-Z].*\.json$/.test(f))) unlinkSync(at('content/packs/' + f));
const written = [];
for (const p of profiles) {
  const id = 'bp' + p.baselineProfileID.replace(/^BP-/, '').toLowerCase().split('-').map(cap).join('');
  const insurance = p.baselineProfileID === 'BP-INSURANCE', financial = FINANCIAL.has(p.baselineProfileID);
  const edits = deep(masFi.edits).flatMap((e, i) => {
    if (insurance && i <= 7) return [];                     // the insurance examples stay
    if (i >= 2 && i <= 7) return [{ ...e, replace: EXAMPLES[i - 2] }];
    if (i === 9 && !financial) return [{ ...e, replace: "The {entity}'s business, operations and compliance staff and an external AI service" }];
    if (i === 12) return [{ ...e, replace: financial ? e.replace : 'change a record or a system' }];
    return [e];
  });
  if (!insurance) edits.push(
    { at: 'frameworkMarkdown', find: '- **{Customer} or claims data.** The assessment works from documents and interviews.', replace: "- **{Customer} data.** The assessment works from documents and interviews." },
    { at: 'frameworkMarkdown', find: '- No {customer}, claimant or staff personal data is collected.', replace: '- No {customer} or staff personal data is collected.' },
  );
  // The framework's open item for counsel on Australian paragraph references does not apply to a baseline.
  edits.push({ at: 'frameworkMarkdown', find: '- [ ] **CPS 230 paragraph references.** Paragraphs 5, 53(b), 54 and 60(b) are cited as they appear in the decks. Confirm each against the instrument in force.', replace: "- [ ] **The jurisdiction's own references.** A baseline cites no jurisdiction's rules; counsel confirms the references the matter brief brings in." });
  const override = deep(masFi.override);
  override['authorityTests.1'] = 'Does the output move money, change a record or a system, or commit the {entity}?';
  if (!financial) override['boundaries.2.parties'] = "The {entity}'s business, operations and compliance staff and an external AI service";
  const pack = {
    id, name: `${p.name} (best-practice baseline)`, jurisdiction: 'any', entityTypes: [], baseline: p.baselineProfileID, governingBody: p.governingBody,
    note: `Generated from Triodian Metamodel ${version} (reference-data/baseline-profiles.json) by tools/build-baseline-packs.mjs; do not edit by hand. A best-practice baseline for ${p.description.toLowerCase()} that holds in any jurisdiction; it names no regulator, and the jurisdiction's own obligations come from the matter brief.`,
    nouns: NOUNS[p.baselineProfileID],
    replace: { documents: deep(masFi.replace.documents) },
    override,
    edits,
  };
  if (!pack.nouns) throw new Error('No nouns for ' + p.baselineProfileID);
  writeFileSync(at(`content/packs/${id}.json`), JSON.stringify(pack, null, 2) + '\n');
  written.push(id);
}
console.log(`${written.length} baseline packs from Metamodel ${version}: ${written.join(', ')}`);
