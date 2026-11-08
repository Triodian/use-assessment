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
