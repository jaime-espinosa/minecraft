import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

import {
  ContractValidationError,
  validateAppearanceSnapshotV1,
  validateArtifactBundleV1,
  validateArtifactV1,
  validateAvatarFrame,
  validateAvatarOperation,
  validateAvatarRecipeV1,
  validateFieldProvenanceV1,
  validateIdentityOperation,
  validateIdentityProfileV1,
  validateLocalPreflightCheckV1,
  validateLocalPreflightReportV1,
  validateProposedIdentityChangeV1,
  validateSemanticAppearanceV1,
  validateSourcePhotoV1,
  validateIdentity,
  validateProvenance,
  validateRecipe,
} from '../../src/domain/contracts.js';
import {
  DEFAULT_IDENTITY,
  DEFAULT_RECIPE,
  createDefaultIdentity,
  createDefaultRecipe,
} from '../../src/domain/defaults.js';

const defaultProvenance = () => ({
  source: 'default',
  sourcePhotoIds: [],
  evidenceState: 'not-applicable',
});

const semanticAppearance = () => ({
  complexionPalette: DEFAULT_IDENTITY.complexionPalette,
  hair: DEFAULT_IDENTITY.hair,
  face: DEFAULT_IDENTITY.face,
  outfit: DEFAULT_IDENTITY.outfit,
  accessories: DEFAULT_IDENTITY.accessories,
  style: DEFAULT_RECIPE.style,
});

const sourcePhoto = (focusSize = 1) => ({
  id: 'photo-1',
  role: 'face-front',
  blobKey: 'blob-1',
  pixelDigest: 'a'.repeat(64),
  mimeType: 'image/jpeg',
  width: 100,
  height: 100,
  createdAt: '2026-07-11T00:00:00.000Z',
  normalizationVersion: 'normalize-v1',
  focusRegion: { centerX: 0.5, centerY: 0.5, size: focusSize },
});

test('accepts only the three valid provenance combinations', () => {
  const retained = {
    source: 'photo-analysis',
    sourcePhotoIds: ['photo-1'],
    evidenceState: 'available',
    analyzerVersion: 'palette-v1',
    confidence: 'high',
  };
  const deleted = {
    source: 'photo-analysis',
    sourcePhotoIds: [],
    evidenceState: 'deleted',
    analyzerVersion: 'palette-v1',
    confidence: 'review',
  };

  assert.deepEqual(validateFieldProvenanceV1(defaultProvenance()), defaultProvenance());
  assert.deepEqual(validateFieldProvenanceV1({ ...defaultProvenance(), source: 'manual' }), {
    ...defaultProvenance(),
    source: 'manual',
  });
  assert.deepEqual(validateFieldProvenanceV1(retained), retained);
  assert.deepEqual(validateFieldProvenanceV1(deleted), deleted);

  for (const invalid of [
    { source: 'default', sourcePhotoIds: ['photo-1'], evidenceState: 'not-applicable' },
    { source: 'manual', sourcePhotoIds: [], evidenceState: 'available' },
    { source: 'photo-analysis', sourcePhotoIds: [], evidenceState: 'available' },
    { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'deleted' },
  ]) {
    assert.throws(() => validateFieldProvenanceV1(invalid), ContractValidationError);
  }
});

test('rejects unknown keys, non-finite numbers, malformed colors, and unsupported enums', () => {
  assert.throws(
    () => validateAvatarRecipeV1({ ...DEFAULT_RECIPE, unexpected: true }),
    /unknown key/i,
  );
  assert.throws(
    () => validateSourcePhotoV1({ ...sourcePhoto(), width: Number.POSITIVE_INFINITY }),
    /finite/i,
  );
  assert.throws(
    () => validateIdentityProfileV1({
      ...DEFAULT_IDENTITY,
      complexionPalette: { ...DEFAULT_IDENTITY.complexionPalette, primary: '#ABCDEF' },
    }),
    /lowercase six-digit/i,
  );
  assert.throws(
    () => validateAvatarRecipeV1({
      ...DEFAULT_RECIPE,
      platformProfiles: {
        ...DEFAULT_RECIPE.platformProfiles,
        minecraft: { geometry: 'wide', outerLayers: true },
      },
    }),
    /unsupported/i,
  );
});

test('rejects privacy-forbidden fields from semantic appearance', () => {
  const appearance = semanticAppearance();

  assert.deepEqual(validateSemanticAppearanceV1(appearance), appearance);
  for (const forbiddenKey of ['photo', 'blob', 'mask', 'embedding']) {
    assert.throws(
      () => validateSemanticAppearanceV1({ ...appearance, [forbiddenKey]: 'private' }),
      ContractValidationError,
    );
  }
});

test('accepts the inclusive zero boundary for normalized focus size', () => {
  const photo = sourcePhoto(0);
  assert.equal(validateSourcePhotoV1(photo), photo);
});

test('validates closed snapshot, proposal, operation, and frame contracts', () => {
  const identityOperation = {
    op: 'set-palette',
    field: 'complexion',
    value: DEFAULT_IDENTITY.complexionPalette,
    provenance: defaultProvenance(),
  };
  const avatarOperations = [
    identityOperation,
    { op: 'set-hair', value: { style: 'sweep', volume: 1 } },
    { op: 'set-expression', value: 'grin' },
    { op: 'set-accessories', value: [{ kind: 'glasses', color: '#112233' }] },
    { op: 'set-style', value: { shading: 'soft', outline: true } },
  ];
  const snapshot = {
    schemaVersion: 1,
    identityRevision: 1,
    recipeId: DEFAULT_RECIPE.id,
    recipeRevision: 1,
    semanticAppearance: semanticAppearance(),
    sourceDigest: 'b'.repeat(64),
  };
  const proposal = {
    id: 'proposal-1',
    baseIdentityRevision: 1,
    operations: [identityOperation],
    evidencePhotoIds: ['photo-1'],
    analyzerVersion: 'palette-v1',
    confidence: 'review',
    warnings: ['blur', 'face-detector-unavailable'],
  };
  const frame = { identity: DEFAULT_IDENTITY, recipe: DEFAULT_RECIPE };

  assert.equal(validateAppearanceSnapshotV1(snapshot), snapshot);
  assert.throws(() => validateAppearanceSnapshotV1({ ...snapshot, identityRevision: 0 }), /identityRevision/i);
  const { identityRevision: omittedIdentityRevision, ...missingIdentityRevision } = snapshot;
  assert.equal(omittedIdentityRevision, 1);
  assert.throws(() => validateAppearanceSnapshotV1(missingIdentityRevision), /identityRevision/i);
  assert.equal(validateProposedIdentityChangeV1(proposal), proposal);
  assert.equal(validateIdentityOperation(identityOperation), identityOperation);
  avatarOperations.forEach((operation) => assert.equal(validateAvatarOperation(operation), operation));
  assert.equal(validateAvatarFrame(frame), frame);

  for (const [validator, valid] of [
    [validateAppearanceSnapshotV1, snapshot],
    [validateProposedIdentityChangeV1, proposal],
    [validateIdentityOperation, identityOperation],
    [validateAvatarOperation, avatarOperations[1]],
    [validateAvatarFrame, frame],
  ]) {
    assert.throws(() => validator({ ...valid, unexpected: true }), /unknown key/i);
  }
  assert.throws(() => validateAvatarOperation({ op: 'teleport', value: {} }), /unsupported/i);
  assert.throws(
    () => validateProposedIdentityChangeV1({ ...proposal, warnings: ['identity-match'] }),
    /unsupported/i,
  );
});

test('validates closed preflight and artifact contracts', () => {
  const check = { id: 'dimensions', passed: true, message: 'Dimensions match.' };
  const report = { passed: true, checks: [check] };
  const artifact = {
    filename: 'my-avatar-minecraft.png',
    mediaType: 'image/png',
    width: 64,
    height: 64,
    pixelDigest: 'c'.repeat(64),
    bytes: new Uint8Array([1, 2, 3]),
  };
  const bundle = {
    compiler: 'minecraft-v1',
    sourceDigest: 'd'.repeat(64),
    artifacts: [artifact],
  };

  assert.equal(validateLocalPreflightCheckV1(check), check);
  assert.equal(validateLocalPreflightReportV1(report), report);
  assert.equal(validateArtifactV1(artifact), artifact);
  assert.equal(validateArtifactBundleV1(bundle), bundle);

  for (const [validator, valid] of [
    [validateLocalPreflightCheckV1, check],
    [validateLocalPreflightReportV1, report],
    [validateArtifactV1, artifact],
    [validateArtifactBundleV1, bundle],
  ]) {
    assert.throws(() => validator({ ...valid, unexpected: true }), /unknown key/i);
  }
  assert.throws(
    () => validateArtifactBundleV1({ ...bundle, compiler: 'minecraft-v2' }),
    /unsupported/i,
  );
  assert.throws(() => validateArtifactV1({ ...artifact, bytes: [1, 2, 3] }), /Uint8Array/i);

  const crossRealmBytes = runInNewContext('new Uint8Array([1, 2, 3])');
  assert.equal(validateArtifactV1({ ...artifact, bytes: crossRealmBytes }).bytes, crossRealmBytes);

  const spoofedUint8Array = new DataView(new ArrayBuffer(3));
  Object.defineProperty(spoofedUint8Array, Symbol.toStringTag, { value: 'Uint8Array' });
  Object.defineProperty(spoofedUint8Array, 'BYTES_PER_ELEMENT', { value: 1 });
  assert.throws(
    () => validateArtifactV1({ ...artifact, bytes: spoofedUint8Array }),
    /Uint8Array/i,
  );
});

test('closed validators reject symbol and non-enumerable privacy fields', () => {
  const appearanceWithSymbol = {
    ...semanticAppearance(),
    [Symbol('blob')]: new Uint8Array([1]),
  };
  assert.throws(() => validateSemanticAppearanceV1(appearanceWithSymbol), /unknown key/i);

  const artifactWithHiddenPhoto = {
    filename: 'my-avatar-minecraft.png',
    mediaType: 'image/png',
    bytes: new Uint8Array([1]),
  };
  Object.defineProperty(artifactWithHiddenPhoto, 'photoBytes', {
    value: new Uint8Array([9, 9, 9]),
    enumerable: false,
  });
  assert.throws(() => validateArtifactV1(artifactWithHiddenPhoto), /unknown key/i);

  const provenanceWithPhotoBlob = {
    complexion: defaultProvenance(),
    [Symbol('photoBlob')]: new Uint8Array([1]),
  };
  assert.throws(
    () => validateIdentityProfileV1({ ...DEFAULT_IDENTITY, provenance: provenanceWithPhotoBlob }),
    /unknown key/i,
  );
});

test('closed validators reject decorated and accessor-backed arrays', () => {
  const hiddenPhotoBytes = [];
  Object.defineProperty(hiddenPhotoBytes, 'photoBytes', {
    value: new Uint8Array([1]),
    enumerable: false,
  });
  assert.throws(
    () => validateSemanticAppearanceV1({ ...semanticAppearance(), accessories: hiddenPhotoBytes }),
    /unknown key/i,
  );

  const customProperty = [];
  customProperty.custom = 'private';
  assert.throws(
    () => validateSemanticAppearanceV1({ ...semanticAppearance(), accessories: customProperty }),
    /unknown key/i,
  );

  let getterCalled = false;
  const accessorArray = [{ kind: 'glasses', color: '#112233' }];
  Object.defineProperty(accessorArray, '0', {
    enumerable: true,
    get() { getterCalled = true; return { kind: 'beard', color: '#112233' }; },
  });
  assert.throws(
    () => validateSemanticAppearanceV1({ ...semanticAppearance(), accessories: accessorArray }),
    /accessor/i,
  );
  assert.equal(getterCalled, false);
});

test('exports deeply frozen valid defaults at revision one', () => {
  assert.deepEqual(createDefaultIdentity(), DEFAULT_IDENTITY);
  assert.deepEqual(createDefaultRecipe(), DEFAULT_RECIPE);
  assert.equal(DEFAULT_RECIPE.localLabel, 'Avatar 1');
  assert.equal(DEFAULT_RECIPE.revision, 1);
  assert.equal(DEFAULT_RECIPE.identityRevision, 1);
  assert.equal(DEFAULT_IDENTITY.revision, 1);
  assert.doesNotThrow(() => validateIdentityProfileV1(DEFAULT_IDENTITY));
  assert.doesNotThrow(() => validateAvatarRecipeV1(DEFAULT_RECIPE));

  assert.equal(Object.isFrozen(DEFAULT_IDENTITY), true);
  assert.equal(Object.isFrozen(DEFAULT_IDENTITY.hair.palette), true);
  assert.equal(Object.isFrozen(DEFAULT_IDENTITY.accessories), true);
  assert.equal(Object.isFrozen(DEFAULT_RECIPE), true);
  assert.equal(Object.isFrozen(DEFAULT_RECIPE.platformProfiles.minecraft), true);
  assert.throws(() => { DEFAULT_RECIPE.style.shading = 'soft'; }, TypeError);

  const keys = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      keys.push(key);
      visit(nested);
    }
  };
  visit({ identity: DEFAULT_IDENTITY, recipe: DEFAULT_RECIPE });
  assert.deepEqual(
    keys.filter((key) => /photo|blob|mask|embedding/i.test(key)),
    ['sourcePhotoIds', 'sourcePhotoIds', 'sourcePhotoIds', 'sourcePhotoIds', 'sourcePhotoIds'],
  );
});

test('public validators return typed Results without coercing input', () => {
  assert.deepEqual(validateIdentity(DEFAULT_IDENTITY), { ok: true, value: DEFAULT_IDENTITY });
  assert.deepEqual(validateRecipe(DEFAULT_RECIPE), { ok: true, value: DEFAULT_RECIPE });
  assert.deepEqual(validateProvenance(defaultProvenance()), {
    ok: true,
    value: defaultProvenance(),
  });

  const invalid = { ...DEFAULT_RECIPE, revision: Number.NaN };
  const result = validateRecipe(invalid);
  assert.equal(result.ok, false);
  assert.equal(result.fault.kind, 'invalid-seed');
  assert.equal(result.fault.path, '$.revision');
  assert.match(result.fault.message, /finite/i);
  assert.equal(Number.isNaN(invalid.revision), true);
});
