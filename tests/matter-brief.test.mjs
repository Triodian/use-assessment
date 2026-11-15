// The matter brief reader (public/shared/matter-brief.js, the same file as AI Board Direction's) against a brief the
// AI Obligations Atlas builds, and the server's check of a stored brief.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBrief, briefMismatch, BRIEF_FORMAT } from '../public/shared/matter-brief.js';
import { structureError } from '../lib/core/rbac.js';

const raw = fs.readFileSync(new URL('./fixtures/matter-brief-au-general-insurer.json', import.meta.url), 'utf8');

test('a brief from the Atlas reads, with its obligations by tier and its questions for counsel', () => {
  const { brief, error } = readBrief(raw, {}, '2026-11-08', 'Sam Okoro');
  assert.equal(error, undefined);
  assert.equal(brief.format, BRIEF_FORMAT);
  assert.deepEqual(brief.tiers.map((t) => t.tier), ['Binding', 'Expected', 'Anticipated']);
  assert.ok(brief.tiers[0].refs.length > 0);
  assert.ok(brief.questions.length > 0);
  assert.equal(brief.loadedBy, 'Sam Okoro');
  assert.ok(!JSON.stringify(brief).includes('Fixture'), 'the matter label is not kept');
});

test('anything else is refused with the reason', () => {
  assert.match(readBrief('not json').error, /not valid JSON/);
  assert.match(readBrief('{"briefFormat":"triodian.matterBrief/9"}').error, /format/);
});

test('the server accepts a stored brief and refuses a broken one', () => {
  const { brief } = readBrief(raw);
  assert.equal(structureError({ engagement: { matterBrief: brief } }), '');
  assert.match(structureError({ engagement: { matterBrief: { tiers: 'x' } } }), /no obligations by tier/);
});

// Task ISO.8: a brief built with the client's Statement of Applicability loaded carries a fourth list, the controls of
// a standard the client has adopted for itself. It is kept when present; a brief without it reads as before.
test('an adopted-standard list in the brief is kept, under its own name', () => {
  const b = JSON.parse(raw);
  b.obligationsByTier.adopted = [{ obligationID: 'OBL-INT-ISO42001-A-10-3', title: 'A.10.3 Suppliers', instrument: 'ISO/IEC 42001:2023', citation: 'Annex A, control A.10.3', status: 'inForce', sourceURL: 'https://www.iso.org/standard/42001', lastVerified: '2026-11-13', governedRecordID: 'OBL-INT-ISO42001-A-10-3@1', statementOfApplicability: { applicable: true, justification: 'Material service providers', implementation: 'Implemented in part' } }];
  const { brief, error } = readBrief(b, {}, '2026-11-13', 'Sam Okoro');
  assert.equal(error, undefined);
  assert.deepEqual(brief.tiers.map((t) => t.tier), ['Binding', 'Expected', 'Anticipated', 'Adopted standard']);
  assert.equal(brief.tiers[3].refs[0][0], 'OBL-INT-ISO42001-A-10-3');
  assert.deepEqual(readBrief(raw).brief.tiers.map((t) => t.tier), ['Binding', 'Expected', 'Anticipated'], 'a brief without one is unchanged');
  assert.match(readBrief({ ...b, obligationsByTier: { ...b.obligationsByTier, adopted: 'x' } }).error, /adopted-standard references/);
});

test('provenance survives the import: sectors, the dataset ledger position and each reference’s applicability (S.6)', () => {
  const src = JSON.parse(raw), { brief } = readBrief(raw);
  assert.equal(brief.dataset.name, src.dataset.name);
  assert.equal(brief.dataset.metamodelVersion, src.dataset.metamodelVersion);
  assert.deepEqual(brief.dataset.ledgerHead, src.dataset.ledgerHead);
  const first = src.obligationsByTier.binding[0], kept = brief.tiers[0].refs[0][6];
  assert.equal(kept.governedRecordID, first.governedRecordID);
  assert.equal(kept.provenanceRef, first.provenanceRef);
  assert.deepEqual(kept.useCaseIDs, first.useCaseIDs);
  assert.equal(kept.appliesToAnyAIUse, first.appliesToAnyAIUse);
  assert.equal(kept.lastVerified, first.lastVerified);
  assert.deepEqual(kept.keyDates.map(d => d.date), first.keyDates.map(d => d.date));
  // a brief scoped to sectors keeps them (schema shape: { regulatedSectorID, name }), and a sector mismatch is reported
  const withSectors = { ...src, scope: { ...src.scope, sectors: [{ regulatedSectorID: 'AU-INSURANCE', name: 'Insurance' }] } };
  const b2 = readBrief(JSON.stringify(withSectors)).brief;
  assert.deepEqual(b2.scopeCodes.sectors, ['AU-INSURANCE']);
  assert.match(b2.scope, /sectors AU-INSURANCE/);
  assert.equal(briefMismatch(b2, { sector: 'AU-INSURANCE' }).length, 0);
  assert.match(briefMismatch(b2, { sector: 'AU-SUPERANNUATION' })[0], /scoped to Insurance; the engagement is in AU-SUPERANNUATION/);
  // an adopted-standard record keeps the client's Statement of Applicability row
  const soa = { obligationID: 'ISO42001-A.5.2', title: 'AI system impact assessment process', instrument: 'ISO/IEC 42001:2023 Annex A', citation: 'A.5.2', status: 'adopted', statementOfApplicability: { applicable: true, justification: 'Required by the board’s AI policy', implementation: 'Partly implemented' } };
  const b3 = readBrief(JSON.stringify({ ...src, obligationsByTier: { ...src.obligationsByTier, adopted: [soa] } })).brief;
  const adopted = b3.tiers.find(t => t.tier === 'Adopted standard').refs[0][6];
  assert.deepEqual(adopted.statementOfApplicability, soa.statementOfApplicability);
  // the server still accepts the richer stored brief
  assert.equal(structureError({ engagement: { matterBrief: brief } }), '');
});
