import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { validateAvatarFrame } from '../../src/domain/contracts.js';
import { createDefaultIdentity, createDefaultRecipe } from '../../src/domain/defaults.js';

const manualProvenance = () => ({
  source: 'manual',
  sourcePhotoIds: [],
  evidenceState: 'not-applicable',
});

test('start returns a deeply frozen valid default frame', () => {
  const result = createAvatarKernel().start();

  assert.equal(result.ok, true);
  assert.doesNotThrow(() => validateAvatarFrame(result.value));
  assert.equal(result.value.identity.revision, 1);
  assert.equal(result.value.recipe.revision, 1);
  assert.equal(result.value.recipe.localLabel, 'Avatar 1');
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.identity.hair.palette), true);
  assert.equal(Object.isFrozen(result.value.recipe.platformProfiles.minecraft), true);
});

test('start accepts a complete valid seed without retaining mutable aliases', () => {
  const seed = {
    identity: createDefaultIdentity(),
    recipe: { ...createDefaultRecipe(), localLabel: 'Explorer' },
  };
  const result = createAvatarKernel().start(seed);

  assert.equal(result.ok, true);
  assert.equal(result.value.recipe.localLabel, 'Explorer');
  assert.notEqual(result.value, seed);
  assert.notEqual(result.value.recipe, seed.recipe);
  assert.equal(Object.isFrozen(result.value), true);
});

test('start returns an invalid-seed fault for incomplete or unknown input', () => {
  for (const seed of [
    null,
    { identity: createDefaultIdentity() },
    { identity: createDefaultIdentity(), recipe: createDefaultRecipe(), photoBlob: new Uint8Array([1]) },
  ]) {
    const result = createAvatarKernel().start(seed);
    assert.equal(result.ok, false);
    assert.equal(result.fault.kind, 'invalid-seed');
    assert.match(result.fault.path, /^\$/);
  }
});

test('transact rejects unknown envelope keys without invoking accessors or mutating', () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const before = structuredClone(frame);
  const operation = { op: 'set-expression', value: 'grin' };
  const base = { frame, baseRevision: 1, operations: [operation] };
  const withHidden = { ...base };
  Object.defineProperty(withHidden, 'photoBytes', {
    value: new Uint8Array([1]),
    enumerable: false,
  });
  const withSymbol = { ...base, [Symbol('photoBlob')]: new Uint8Array([1]) };
  let getterCalled = false;
  const withAccessor = { ...base };
  Object.defineProperty(withAccessor, 'operations', {
    enumerable: true,
    get() { getterCalled = true; return [operation]; },
  });

  for (const input of [
    { ...base, unexpected: true },
    withHidden,
    withSymbol,
    withAccessor,
  ]) {
    const result = kernel.transact(input);
    assert.equal(result.ok, false);
    assert.equal(result.fault.kind, 'invalid-operation');
    assert.deepEqual(frame, before);
  }
  assert.equal(getterCalled, false);
});

test('transact applies every closed operation and increments affected revisions once', () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const before = structuredClone(frame);
  const complexion = { primary: '#112233', shadow: '#08111a', highlight: '#334455' };
  const accessories = [{ kind: 'glasses', color: '#abcdef' }];
  const operations = [
    { op: 'set-palette', field: 'complexion', value: complexion, provenance: manualProvenance() },
    { op: 'set-hair', value: { style: 'sweep', volume: 1 } },
    { op: 'set-expression', value: 'grin' },
    { op: 'set-accessories', value: accessories },
    { op: 'set-style', value: { shading: 'soft', outline: true } },
  ];

  const result = kernel.transact({ frame, baseRevision: 1, operations });

  assert.equal(result.ok, true);
  assert.equal(result.value.identity.revision, 2);
  assert.equal(result.value.recipe.revision, 2);
  assert.equal(result.value.recipe.identityRevision, 2);
  assert.deepEqual(result.value.identity.complexionPalette, complexion);
  assert.deepEqual(result.value.identity.provenance.complexion, manualProvenance());
  assert.equal(result.value.identity.hair.style, 'sweep');
  assert.equal(result.value.identity.hair.volume, 1);
  assert.equal(result.value.identity.face.expression, 'grin');
  assert.deepEqual(result.value.identity.accessories, accessories);
  assert.deepEqual(result.value.recipe.style, { shading: 'soft', outline: true });
  assert.doesNotThrow(() => validateAvatarFrame(result.value));
  assert.equal(Object.isFrozen(result.value), true);
  assert.deepEqual(frame, before);
});

test('set-palette updates only its selected semantic field', () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const footwear = { primary: '#010203', shadow: '#000102', highlight: '#030405' };
  const result = kernel.transact({
    frame,
    baseRevision: 1,
    operations: [{ op: 'set-palette', field: 'footwear', value: footwear, provenance: manualProvenance() }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.identity.outfit.footwear, footwear);
  assert.deepEqual(result.value.identity.outfit.top, frame.identity.outfit.top);
  assert.deepEqual(result.value.identity.outfit.bottom, frame.identity.outfit.bottom);
  assert.deepEqual(result.value.identity.provenance.footwear, manualProvenance());
});

test('recipe-only style edits leave the identity revision unchanged', () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const result = kernel.transact({
    frame,
    baseRevision: 1,
    operations: [{ op: 'set-style', value: { shading: 'soft', outline: false } }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.identity.revision, 1);
  assert.equal(result.value.recipe.identityRevision, 1);
  assert.equal(result.value.recipe.revision, 2);
});

test('transact returns revision-conflict before applying stale operations', () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const result = kernel.transact({
    frame,
    baseRevision: 0,
    operations: [{ op: 'set-expression', value: 'grin' }],
  });

  assert.deepEqual(result, {
    ok: false,
    fault: {
      kind: 'revision-conflict',
      message: 'Expected recipe revision 1 but received 0',
    },
  });
  assert.equal(frame.identity.face.expression, 'smile');
});

test('invalid operations return faults without mutating the input frame', () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const before = structuredClone(frame);
  const invalidInputs = [
    { frame, baseRevision: 1, operations: [{ op: 'teleport', value: {} }] },
    { frame, baseRevision: 1, operations: [] },
    { frame, baseRevision: 1, operations: [{ op: 'set-expression', value: 'surprised' }] },
  ];

  for (const input of invalidInputs) {
    const result = kernel.transact(input);
    assert.equal(result.ok, false);
    assert.equal(result.fault.kind, 'invalid-operation');
    assert.deepEqual(frame, before);
  }
});
