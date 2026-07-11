import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultIdentity, createDefaultRecipe } from '../../src/domain/defaults.js';
import { openIdentityLibrary } from '../../src/identity-library/repository.js';
import { createArtifactRecord, createDraft, createFakeIndexedDB, createNormalizedPhoto } from '../support/fake-indexeddb.js';

const setup = async () => (await openIdentityLibrary({ indexedDB: createFakeIndexedDB(), databaseName: `delete-${crypto.randomUUID()}`, clock: () => 'now', createId: (() => { let id = 0; return () => `library-${++id}`; })() })).value;

const photoIdentity = () => {
  const identity = structuredClone(createDefaultIdentity());
  identity.revision = 2;
  identity.provenance.hair = { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'available' };
  return identity;
};

test('photo deletion cascades private derivatives and sanitizes accepted provenance atomically', async () => {
  const repository = await setup();
  await repository.storeNormalizedPhoto(createNormalizedPhoto({ metadata: { role: 'hair-detail' } }));
  await repository.saveIdentity(photoIdentity(), { baseRevision: 1 });
  await repository.putDraft(createDraft());
  await repository.putArtifact(createArtifactRecord());
  assert.equal((await repository.deletePhoto('photo-1')).ok, true);
  const state = await repository.readLibrary();
  assert.deepEqual(state.photos, []); assert.deepEqual(state.drafts, []); assert.deepEqual(state.artifacts, []);
  assert.deepEqual(state.identities.at(-1).provenance.hair, { source: 'photo-analysis', sourcePhotoIds: [], evidenceState: 'deleted' });
  assert.doesNotMatch(JSON.stringify(state), /photo-1/);
});

test('all-photo, look, and full-library deletion are explicit and bounded', async () => {
  const repository = await setup();
  await repository.storeNormalizedPhoto(createNormalizedPhoto());
  await repository.storeNormalizedPhoto(createNormalizedPhoto({ metadata: { id: 'photo-2', blobKey: 'blob-2', role: 'hair-detail', pixelDigest: 'b'.repeat(64) } }));
  const recipe2 = structuredClone(createDefaultRecipe()); recipe2.id = 'avatar-2';
  await repository.saveRecipe(recipe2, { baseRevision: 0 });
  await repository.deleteAllPhotos();
  assert.equal((await repository.readLibrary()).photos.length, 0);
  await repository.putDraft(createDraft({ id: 'draft-look-2', recipeId: 'avatar-2', sourcePhotoIds: [], operations: [] }));
  await repository.putArtifact(createArtifactRecord({ id: 'artifact-look-2', recipeId: 'avatar-2', sourcePhotoIds: [] }));
  assert.equal((await repository.deleteLook('avatar-2')).ok, true);
  const afterLook = await repository.readLibrary();
  assert.equal(afterLook.recipes.length, 1); assert.deepEqual(afterLook.drafts, []); assert.deepEqual(afterLook.artifacts, []);
  assert.equal((await repository.deleteLibrary({ confirmed: true })).ok, true);
  const state = await repository.readLibrary();
  assert.equal(state.meta, null); assert.equal(state.identities.length, 0); assert.equal(state.recipes.length, 0);
});

test('confirmed new-person reset clears every store in one transaction and abort preserves prior data', async () => {
  const repository = await setup();
  await repository.storeNormalizedPhoto(createNormalizedPhoto());
  await repository.putDraft(createDraft({ sourcePhotoIds: [], operations: [] })); await repository.putArtifact(createArtifactRecord({ sourcePhotoIds: [] }));
  const before = await repository.readLibrary();
  const rejected = await repository.resetForNewPerson({ confirmed: true, beforeCommit: () => { throw new Error('abort'); } });
  assert.equal(rejected.ok, false);
  assert.deepEqual(await repository.readLibrary(), before);
  assert.equal((await repository.resetForNewPerson({ confirmed: true })).ok, true);
  const after = await repository.readLibrary();
  assert.equal(after.meta.libraryId, 'library-3');
  for (const store of ['photos', 'identities', 'recipes', 'drafts', 'artifacts']) assert.deepEqual(after[store], []);
});
