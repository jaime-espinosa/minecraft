import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalJson } from '../../src/domain/canonical-json.js';
import { createDefaultIdentity } from '../../src/domain/defaults.js';
import { exportLibraryBackup, importLibraryBackup } from '../../src/identity-library/backup.js';
import { openIdentityLibrary } from '../../src/identity-library/repository.js';
import { createFakeIndexedDB, createNormalizedPhoto } from '../support/fake-indexeddb.js';

const open = async (libraryId = 'library-a') => (await openIdentityLibrary({ indexedDB: createFakeIndexedDB(), databaseName: `backup-${crypto.randomUUID()}`, clock: () => '2026-07-11T12:00:00.000Z', createId: () => libraryId })).value;

test('exports exact canonical photo-free v1 shape with sanitized provenance', async () => {
  const repository = await open();
  const identity = structuredClone(createDefaultIdentity()); identity.revision = 2;
  identity.provenance.hair = { source: 'photo-analysis', sourcePhotoIds: ['secret-photo'], evidenceState: 'available' };
  await repository.saveIdentity(identity, { baseRevision: 1 });
  const result = await exportLibraryBackup(repository);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.value.document), ['format', 'version', 'libraryId', 'exportedAt', 'activeIdentity', 'recipes', 'activeRecipeId']);
  assert.equal(result.value.json, canonicalJson(result.value.document));
  assert.deepEqual(result.value.document.activeIdentity.provenance.hair, { source: 'photo-analysis', sourcePhotoIds: [], evidenceState: 'deleted' });
  assert.doesNotMatch(result.value.json, /secret-photo|blob|digest|focusRegion|mask|analyzer/i);
});

test('empty restore succeeds, foreign nonempty restore rejects, matching confirmed replacement clears photos', async () => {
  const source = await open('library-a');
  const exported = await exportLibraryBackup(source);
  const empty = await open('empty-id'); await empty.deleteLibrary({ confirmed: true });
  assert.equal((await importLibraryBackup(empty, exported.value.json)).ok, true);
  assert.equal((await empty.readLibrary()).meta.libraryId, 'library-a');

  const foreign = await open('library-b');
  const before = await foreign.readLibrary();
  const rejected = await importLibraryBackup(foreign, exported.value.json);
  assert.equal(rejected.fault.kind, 'foreign-library');
  assert.deepEqual(await foreign.readLibrary(), before);

  await source.storeNormalizedPhoto(createNormalizedPhoto({ metadata: { id: 'private', blobKey: 'private-blob' } }));
  assert.equal((await importLibraryBackup(source, exported.value.document, { confirmed: true })).ok, true);
  assert.deepEqual((await source.readLibrary()).photos, []);
});

test('invalid backup causes zero mutation', async () => {
  const repository = await open(); const before = await repository.readLibrary();
  const result = await importLibraryBackup(repository, '{"format":"wrong"}');
  assert.equal(result.fault.kind, 'invalid-backup');
  assert.deepEqual(await repository.readLibrary(), before);
});

test('duplicate and dangling recipe backups reject before replacement clears anything', async () => {
  const repository = await open(); const exported = await exportLibraryBackup(repository);
  await repository.storeNormalizedPhoto(createNormalizedPhoto());
  const before = await repository.readLibrary();
  const duplicate = structuredClone(exported.value.document); duplicate.recipes.push(structuredClone(duplicate.recipes[0]));
  assert.equal((await importLibraryBackup(repository, duplicate, { confirmed: true })).fault.kind, 'invalid-backup');
  assert.equal((await repository.replaceFromBackup(duplicate)).fault.kind, 'invalid-backup');
  const dangling = structuredClone(exported.value.document); dangling.recipes[0].identityRevision = 99;
  assert.equal((await importLibraryBackup(repository, dangling, { confirmed: true })).fault.kind, 'invalid-backup');
  assert.deepEqual(await repository.readLibrary(), before);
});

test('revision-two identity backup round-trips into an empty library with consistent recipes', async () => {
  const source = await open('library-roundtrip');
  const recipe2 = structuredClone((await source.readLibrary()).recipes[0]); recipe2.id = 'avatar-2'; recipe2.localLabel = 'Second';
  await source.saveRecipe(recipe2, { baseRevision: 0 });
  const identity = structuredClone(createDefaultIdentity()); identity.revision = 2;
  assert.equal((await source.saveIdentity(identity, { baseRevision: 1 })).ok, true);
  const exported = await exportLibraryBackup(source); assert.equal(exported.ok, true);
  const target = await open('temporary'); await target.deleteLibrary({ confirmed: true });
  assert.equal((await importLibraryBackup(target, exported.value.json)).ok, true);
  const restored = await target.readLibrary();
  assert.deepEqual(restored.identities, [identity]);
  assert.deepEqual(restored.recipes, exported.value.document.recipes);
  assert.ok(restored.recipes.every(({ identityRevision }) => identityRevision === identity.revision));
  assert.equal(restored.meta.activeRecipeId, exported.value.document.activeRecipeId);
});

test('backup replacement rejects a lineage changed between authorization read and write', async () => {
  const indexedDB = createFakeIndexedDB(), databaseName = `race-${crypto.randomUUID()}`;
  let next = 0; const options = { indexedDB, databaseName, clock: () => '2026-07-11T12:00:00.000Z', createId: () => `library-${++next}` };
  const first = (await openIdentityLibrary(options)).value;
  const second = (await openIdentityLibrary(options)).value;
  const exported = await exportLibraryBackup(first);
  const racingRepository = {
    readLibrary: () => first.readLibrary(),
    replaceFromBackup: async (document, authorization) => {
      await second.resetForNewPerson({ confirmed: true });
      return first.replaceFromBackup(document, authorization);
    },
  };
  const result = await importLibraryBackup(racingRepository, exported.value.document, { confirmed: true });
  assert.equal(result.fault.kind, 'library-changed');
  const state = await first.readLibrary();
  assert.equal(state.meta.libraryId, 'library-2');
  assert.deepEqual(state.identities, []); assert.deepEqual(state.recipes, []);
});
