// The matter brief reader (public/shared/matter-brief.js, the same file as AI Board Direction's) against a brief the
// AI Obligations Atlas builds, and the server's check of a stored brief.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBrief, BRIEF_FORMAT } from '../public/shared/matter-brief.js';
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
