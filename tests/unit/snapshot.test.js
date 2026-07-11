import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { validateAppearanceSnapshotV1 } from '../../src/domain/contracts.js';

const collectKeys = (value, keys = []) => {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectKeys(nested, keys);
  }
  return keys;
};

test('snapshot projects accepted identity appearance plus recipe style', async () => {
  const kernel = createAvatarKernel();
  const started = kernel.start().value;
  const frame = kernel.transact({
    frame: started,
    baseRevision: 1,
    operations: [
      { op: 'set-expression', value: 'grin' },
      { op: 'set-style', value: { shading: 'soft', outline: true } },
    ],
  }).value;

  const snapshot = await kernel.snapshot(frame);

  assert.deepEqual(Object.keys(snapshot), [
    'schemaVersion',
    'recipeId',
    'recipeRevision',
    'semanticAppearance',
    'sourceDigest',
  ]);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.recipeId, frame.recipe.id);
  assert.equal(snapshot.recipeRevision, frame.recipe.revision);
  assert.deepEqual(snapshot.semanticAppearance.complexionPalette, frame.identity.complexionPalette);
  assert.deepEqual(snapshot.semanticAppearance.hair, frame.identity.hair);
  assert.equal(snapshot.semanticAppearance.face.expression, 'grin');
  assert.deepEqual(snapshot.semanticAppearance.outfit, frame.identity.outfit);
  assert.deepEqual(snapshot.semanticAppearance.accessories, frame.identity.accessories);
  assert.deepEqual(snapshot.semanticAppearance.style, frame.recipe.style);
  assert.match(snapshot.sourceDigest, /^[0-9a-f]{64}$/);
  assert.doesNotThrow(() => validateAppearanceSnapshotV1(snapshot));
});

test('snapshot is deterministic, canonical, deeply frozen, and privacy-safe', async () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;

  const first = await kernel.snapshot(frame);
  const second = await kernel.snapshot(structuredClone(frame));

  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.semanticAppearance), true);
  assert.equal(Object.isFrozen(first.semanticAppearance.hair.palette), true);
  assert.equal(Object.isFrozen(first.semanticAppearance.accessories), true);
  assert.throws(() => { first.semanticAppearance.face.expression = 'grin'; }, TypeError);

  const forbidden = collectKeys(first).filter((key) => (
    /provenance|photo|blob|focus|analyzer|biometric|embedding|mask/i.test(key)
  ));
  assert.deepEqual(forbidden, []);
  assert.equal(JSON.stringify(first).includes('sourcePhotoIds'), false);
});

test('snapshot rejects an invalid frame without producing an artifact input', async () => {
  const kernel = createAvatarKernel();
  const frame = structuredClone(kernel.start().value);
  frame.recipe.identityRevision = 99;

  await assert.rejects(() => kernel.snapshot(frame), /identity revision/i);
});
