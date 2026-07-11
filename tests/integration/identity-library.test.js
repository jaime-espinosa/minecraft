import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultIdentity, createDefaultRecipe } from '../../src/domain/defaults.js';
import { DB_NAME, STORE_NAMES } from '../../src/identity-library/database.js';
import { openIdentityLibrary } from '../../src/identity-library/repository.js';
import { createArtifactRecord, createDraft, createFakeIndexedDB, createNormalizedPhoto } from '../support/fake-indexeddb.js';

const open = (overrides = {}) => openIdentityLibrary({
  indexedDB: createFakeIndexedDB(), databaseName: `library-${crypto.randomUUID()}`,
  clock: () => '2026-07-11T12:00:00.000Z', createId: () => 'library-a',
  storageEstimate: async () => ({ usage: 10, quota: 1_000_000 }), ...overrides,
});

test('opens my-avatars v1 with the exact six durable stores and one default lineage', async () => {
  assert.equal(DB_NAME, 'my-avatars');
  assert.deepEqual(STORE_NAMES, ['meta', 'photos', 'identities', 'recipes', 'drafts', 'artifacts']);
  const result = await open({ databaseName: DB_NAME });
  assert.equal(result.ok, true);
  assert.deepEqual([...result.value.db.objectStoreNames].sort(), [...STORE_NAMES].sort());
  const state = await result.value.readLibrary();
  assert.equal(state.meta.libraryId, 'library-a');
  assert.deepEqual(state.identities, [createDefaultIdentity()]);
  assert.deepEqual(state.recipes, [createDefaultRecipe()]);
});

test('saves many recipes for one lineage and rejects stale revisions without partial writes', async () => {
  const { value: repository } = await open();
  const recipe2 = structuredClone(createDefaultRecipe()); recipe2.id = 'avatar-2'; recipe2.localLabel = 'Second';
  assert.equal((await repository.saveRecipe(recipe2, { baseRevision: 0 })).ok, true);
  const stale = structuredClone(recipe2); stale.revision = 2; stale.localLabel = 'Stale';
  const result = await repository.saveRecipe(stale, { baseRevision: 0 });
  assert.deepEqual(result.fault.kind, 'revision-conflict');
  const state = await repository.readLibrary();
  assert.equal(state.identities.length, 1);
  assert.equal(state.recipes.length, 2);
  assert.equal(state.recipes.find(({ id }) => id === 'avatar-2').localLabel, 'Second');
});

test('saving a new identity revision transactionally rebases every recipe exactly once', async () => {
  const { value: repository } = await open();
  const recipe2 = structuredClone(createDefaultRecipe()); recipe2.id = 'avatar-2'; recipe2.localLabel = 'Second';
  await repository.saveRecipe(recipe2, { baseRevision: 0 });
  const before = await repository.readLibrary(); const activeRecipeId = before.meta.activeRecipeId;
  const identity = structuredClone(createDefaultIdentity()); identity.revision = 2;
  assert.equal((await repository.saveIdentity(identity, { baseRevision: 1 })).ok, true);
  const after = await repository.readLibrary();
  assert.equal(after.meta.activeRecipeId, activeRecipeId);
  for (const previous of before.recipes) {
    const updated = after.recipes.find(({ id }) => id === previous.id);
    assert.equal(updated.revision, previous.revision + 1);
    assert.equal(updated.identityRevision, 2);
    for (const field of ['id', 'localLabel', 'style', 'platformProfiles']) assert.deepEqual(updated[field], previous[field]);
  }
});

test('invalid rebased recipe aborts the identity and every recipe write', async () => {
  const { value: repository } = await open();
  const corrupt = structuredClone(createDefaultRecipe()); corrupt.privatePhotoId = 'forbidden';
  const seed = repository.db.transaction('recipes', 'readwrite'); seed.objectStore('recipes').put(corrupt);
  await new Promise((resolve, reject) => { seed.oncomplete = resolve; seed.onerror = () => reject(seed.error); });
  const before = await repository.readLibrary();
  const identity = structuredClone(createDefaultIdentity()); identity.revision = 2;
  const result = await repository.saveIdentity(identity, { baseRevision: 1 });
  assert.equal(result.fault.kind, 'invalid-record');
  assert.deepEqual(await repository.readLibrary(), before);
});

test('recipe writes require one-step revision, current identity revision, and unique-ID update semantics', async () => {
  const { value: repository } = await open(); const before = await repository.readLibrary();
  const skipped = structuredClone(createDefaultRecipe()); skipped.id = 'avatar-2'; skipped.revision = 2;
  const dangling = structuredClone(createDefaultRecipe()); dangling.id = 'avatar-2'; dangling.identityRevision = 99;
  assert.equal((await repository.saveRecipe(skipped, { baseRevision: 0 })).fault.kind, 'revision-conflict');
  assert.equal((await repository.saveRecipe(dangling, { baseRevision: 0 })).fault.kind, 'identity-revision-conflict');
  assert.deepEqual(await repository.readLibrary(), before);
  const valid = structuredClone(createDefaultRecipe()); valid.id = 'avatar-2';
  assert.equal((await repository.saveRecipe(valid, { baseRevision: 0 })).ok, true);
  assert.equal((await repository.saveRecipe(valid, { baseRevision: 0 })).fault.kind, 'revision-conflict');
});

test('stores only a closed validated normalized-photo envelope', async () => {
  const { value: repository } = await open();
  assert.equal((await repository.storeNormalizedPhoto(createNormalizedPhoto())).ok, true);
  const state = await repository.readLibrary();
  assert.deepEqual(Object.keys(state.photos[0]), ['metadata', 'blob']);
  assert.equal(state.photos[0].metadata.role, 'face-front');
  assert.equal(await state.photos[0].blob.text(), 'normalized');
  const invalid = [
    createNormalizedPhoto({ metadata: { role: 'face' } }),
    createNormalizedPhoto({ metadata: { width: 2049 } }),
    createNormalizedPhoto({ metadata: { createdAt: 'yesterday' } }),
    createNormalizedPhoto({ metadata: { blobKey: '' } }),
    createNormalizedPhoto({ metadata: { pixelDigest: 'ABC' } }),
    createNormalizedPhoto({ metadata: { normalizationVersion: '' } }),
    createNormalizedPhoto({ metadata: { focusRegion: { centerX: 0.5, centerY: 0.5, size: -0.1 } } }),
    createNormalizedPhoto({ blob: new Blob(['x'], { type: 'image/png' }) }),
    createNormalizedPhoto({ blob: new Blob([], { type: 'image/jpeg' }) }),
  ];
  for (const forbidden of ['filename', 'path', 'raw', 'thumbnail', 'mask', 'analyzer']) invalid.push(createNormalizedPhoto({ [forbidden]: 'private' }));
  for (const candidate of invalid) assert.equal((await repository.storeNormalizedPhoto(candidate)).fault.kind, 'invalid-photo');
  const symbolMetadata = createNormalizedPhoto(); symbolMetadata.metadata[Symbol('path')] = '/private';
  assert.equal((await repository.storeNormalizedPhoto(symbolMetadata)).fault.kind, 'invalid-photo');
  const hidden = createNormalizedPhoto(); Object.defineProperty(hidden.metadata, 'mask', { value: true });
  assert.equal((await repository.storeNormalizedPhoto(hidden)).fault.kind, 'invalid-photo');
  const accessor = createNormalizedPhoto(); Object.defineProperty(accessor.metadata, 'width', { enumerable: true, get: () => 100 });
  assert.equal((await repository.storeNormalizedPhoto(accessor)).fault.kind, 'invalid-photo');
  const decoratedBlob = createNormalizedPhoto(); decoratedBlob.blob.filename = 'private.jpg';
  assert.equal((await repository.storeNormalizedPhoto(decoratedBlob)).fault.kind, 'invalid-photo');
  assert.equal((await repository.readLibrary()).photos.length, 1);
});

test('rejects invalid identity and recipe records before opening a write transaction', async () => {
  const { value: repository } = await open();
  const before = await repository.readLibrary();
  const identity = structuredClone(createDefaultIdentity()); identity.revision = 2; identity.privatePhotoId = 'forbidden';
  const recipe = structuredClone(createDefaultRecipe()); recipe.revision = 2; recipe.unknown = true;
  assert.equal((await repository.saveIdentity(identity, { baseRevision: 1 })).fault.kind, 'invalid-record');
  assert.equal((await repository.saveRecipe(recipe, { baseRevision: 1 })).fault.kind, 'invalid-record');
  assert.deepEqual(await repository.readLibrary(), before);
});

test('maps quota failures to a typed fault and never deletes accepted data', async () => {
  const indexedDB = createFakeIndexedDB();
  const { value: repository } = await open({ indexedDB, storageEstimate: async () => ({ usage: 99, quota: 100 }) });
  const result = await repository.storeNormalizedPhoto(createNormalizedPhoto());
  assert.deepEqual(result.fault.kind, 'quota-exceeded');
  const state = await repository.readLibrary();
  assert.equal(state.photos.length, 0);
  assert.equal(state.identities.length, 1);
  assert.equal(state.recipes.length, 1);
});

test('maps write-time quota failure and rolls the photo transaction back', async () => {
  const indexedDB = createFakeIndexedDB();
  const opened = await open({ indexedDB, beforeWrite: () => { throw new DOMException('disk full', 'QuotaExceededError'); } });
  const before = await opened.value.readLibrary();
  const result = await opened.value.storeNormalizedPhoto(createNormalizedPhoto());
  assert.equal(result.fault.kind, 'quota-exceeded');
  assert.deepEqual(await opened.value.readLibrary(), before);
});

test('reports unavailable IndexedDB as a Result compatible fallback', async () => {
  const result = await openIdentityLibrary({ indexedDB: null });
  assert.equal(result.ok, false);
  assert.equal(result.fault.kind, 'storage-unavailable');
  assert.equal(result.fault.canContinueInMemory, true);
});

test('draft and artifact cache writes accept only closed metadata-only records', async () => {
  const { value: repository } = await open();
  assert.equal((await repository.putDraft(createDraft())).ok, true);
  assert.equal((await repository.putArtifact(createArtifactRecord())).ok, true);
  const invalidDrafts = [
    createDraft({ blob: new Blob(['private']) }), createDraft({ bytes: new Uint8Array([1]) }),
    createDraft({ operations: [{ op: 'set-expression', value: 'smile', recipeId: 'nested' }] }),
    createDraft({ createdAt: 'today' }), createDraft({ baseRecipeRevision: -1 }),
    createDraft({ sourcePhotoIds: [] }),
    createDraft({ sourcePhotoIds: ['photo-1', 'photo-extra'] }),
    createDraft({ sourcePhotoIds: ['photo-1', 'photo-1'] }),
  ];
  const invalidArtifacts = [
    createArtifactRecord({ blob: new Blob(['private']) }), createArtifactRecord({ bytes: new Uint8Array([1]) }),
    createArtifactRecord({ compiler: 'unknown-v1' }), createArtifactRecord({ sourceDigest: 'ABC' }),
    createArtifactRecord({ owner: { recipeId: 'nested' } }),
  ];
  const hidden = createDraft(); Object.defineProperty(hidden, 'mask', { value: true }); invalidDrafts.push(hidden);
  const symbol = createArtifactRecord(); symbol[Symbol('embedding')] = true; invalidArtifacts.push(symbol);
  const accessor = createDraft(); Object.defineProperty(accessor, 'recipeId', { enumerable: true, get: () => 'avatar-1' }); invalidDrafts.push(accessor);
  for (const draft of invalidDrafts) assert.equal((await repository.putDraft(draft)).fault.kind, 'invalid-draft');
  for (const artifact of invalidArtifacts) assert.equal((await repository.putArtifact(artifact)).fault.kind, 'invalid-artifact');
  const state = await repository.readLibrary(); assert.equal(state.drafts.length, 1); assert.equal(state.artifacts.length, 1);
});
