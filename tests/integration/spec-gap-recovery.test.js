import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { bootstrapMyAvatars } from '../../src/integration/bootstrap.js';
import { createBrowserPhotoAdapter } from '../../src/integration/browser-photo-adapter.js';
import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createMinecraftCompiler } from '../../src/compilers/minecraft/compiler.js';
import { createMemoryLibrary } from '../../src/studio-session/memory-library.js';
import { createStudioSession } from '../../src/studio-session/studio-session.js';
import { createFakeIndexedDB, createNormalizedPhoto } from '../support/fake-indexeddb.js';

const unique = (prefix) => `${prefix}-${crypto.randomUUID()}`;

test('retained normalized photos can be retrieved by opaque ID without widening the session or view model', async () => {
  const runtime = await bootstrapMyAvatars({
    indexedDB: createFakeIndexedDB(),
    databaseName: unique('retained-photo'),
  });
  const envelope = createNormalizedPhoto();
  assert.equal((await runtime.session.dispatch({ type: 'add-photo', envelope })).ok, true);

  const retrieved = await runtime.localPhotos.get('photo-1');
  assert.equal(retrieved.ok, true);
  assert.equal(await retrieved.value.blob.text(), 'normalized');
  assert.deepEqual(retrieved.value.metadata, envelope.metadata);
  assert.equal((await runtime.localPhotos.get('missing-photo')).fault.kind, 'photo-not-found');
  assert.deepEqual(Object.keys(runtime.session).sort(), ['dispatch', 'dispose', 'getViewModel', 'subscribe']);
  assert.doesNotMatch(JSON.stringify(runtime.session.getViewModel()), /blob|blobKey|pixelDigest/);
  runtime.dispose();
});

test('retained normalized photos remain retrievable in memory fallback without entering the view model', async () => {
  const runtime = await bootstrapMyAvatars({ indexedDB: null });
  const envelope = createNormalizedPhoto();
  assert.equal((await runtime.session.dispatch({ type: 'add-photo', envelope })).ok, true);
  const result = await runtime.localPhotos.get(envelope.metadata.id);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.metadata, envelope.metadata);
  assert.equal(await result.value.blob.text(), 'normalized');
  assert.doesNotMatch(JSON.stringify(runtime.session.getViewModel()), /blob|blobKey|pixelDigest/);
  runtime.dispose();
});

test('photo-free backup runtime port exports locally and requires explicit replacement confirmation', async () => {
  const runtime = await bootstrapMyAvatars({
    indexedDB: createFakeIndexedDB(),
    databaseName: unique('backup-ui'),
  });
  await runtime.session.dispatch({ type: 'add-photo', envelope: createNormalizedPhoto() });
  const exported = await runtime.libraryBackups.export();
  assert.equal(exported.ok, true);
  assert.equal(exported.value.filename, 'my-avatars-library-backup.json');
  assert.doesNotMatch(exported.value.json, /photo-1|normalized|blob|digest|focusRegion/i);

  const unconfirmed = await runtime.libraryBackups.import(exported.value.json);
  assert.equal(unconfirmed.fault.kind, 'confirmation-required');
  assert.equal((await runtime.libraryBackups.import(exported.value.json, { confirmed: true })).ok, true);
  runtime.dispose();
});

test('fresh durable runtime can explicitly restore a foreign backup as a new person after ordinary import rejects it', async () => {
  const indexedDB = createFakeIndexedDB();
  const source = await bootstrapMyAvatars({ indexedDB, databaseName: unique('backup-source'), createId: () => 'library-a' });
  const target = await bootstrapMyAvatars({ indexedDB, databaseName: unique('backup-target'), createId: () => 'library-b' });
  const backup = await source.libraryBackups.export();

  assert.equal((await target.libraryBackups.import(backup.value.json, { confirmed: true })).fault.kind, 'foreign-library');
  assert.equal(typeof target.libraryBackups.restoreAsNewPerson, 'function');
  assert.equal((await target.libraryBackups.restoreAsNewPerson(backup.value.json)).fault.kind, 'confirmation-required');
  assert.equal((await target.libraryBackups.restoreAsNewPerson(backup.value.json, { confirmed: true })).ok, true);
  const restored = await target.libraryBackups.export();
  assert.equal(restored.value.document.libraryId, 'library-a');
  assert.doesNotMatch(restored.value.json, /blob|pixelDigest|focusRegion/i);

  source.dispose();
  target.dispose();
});

test('quota failure returns the normalized photo for explicit recovery while releasing original bytes', async () => {
  const source = new Uint8Array([9, 8, 7]);
  const bitmap = { width: 1, height: 1, close() {} };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage() {}, clearRect() {} }),
    toBlob(callback, type) { callback(new Blob(['normalized'], { type })); },
  };
  const adapter = createBrowserPhotoAdapter({
    repository: {
      async storeNormalizedPhoto() {
        return { ok: false, fault: { kind: 'quota-exceeded', message: 'Not enough local storage.' } };
      },
      async deletePhoto() { throw new Error('must not delete an uncommitted photo'); },
    },
    createImageBitmap: async () => bitmap,
    createCanvas: () => canvas,
    cryptoObject: { subtle: { digest: async () => new Uint8Array(32).buffer } },
    clock: () => new Date(0).toISOString(),
    createId: (() => { let next = 0; return () => `pending-${++next}`; })(),
  });

  const result = await adapter.normalizeFile({
    file: { type: 'image/jpeg', async arrayBuffer() { return source.buffer; } },
    role: 'face-front',
    focusRegion: { centerX: 0.5, centerY: 0.5, size: 1 },
    confirmed: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.fault.kind, 'quota-exceeded');
  assert.equal(await result.recoverableEnvelope.blob.text(), 'normalized');
  assert.equal(result.recoverableEnvelope.metadata.role, 'face-front');
  assert.deepEqual([...source], [0, 0, 0]);
});

test('quota cleanup can delete only photos unused by accepted identity provenance', async () => {
  const kernel = createAvatarKernel();
  const frame = kernel.start().value;
  const memory = createMemoryLibrary(frame.recipe);
  let usedIds = null;
  const library = {
    ...memory,
    deleteUnusedPhotos(ids) { usedIds = [...ids]; return { ok: true, value: frame }; },
  };
  const session = createStudioSession({ kernel, library, minecraftCompiler: createMinecraftCompiler() });
  const result = await session.dispatch({ type: 'delete-unused-photos' });
  assert.equal(result.ok, true);
  assert.deepEqual(usedIds, []);
  session.dispose();
});

test('continue without saving can analyze in memory while accepted provenance records deleted evidence', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  const analyzer = { analyze: async ({ baseIdentityRevision }) => ({
    ok: true,
    value: {
      id: 'transient-proposal',
      baseIdentityRevision,
      operations: [{
        op: 'set-palette', field: 'hair',
        value: { primary: '#423223', shadow: '#302419', highlight: '#64513d' },
        provenance: { source: 'photo-analysis', sourcePhotoIds: ['pending-photo'], evidenceState: 'available' },
      }],
      evidencePhotoIds: ['pending-photo'], analyzerVersion: 'palette-v1', confidence: 'high', warnings: [],
    },
  }) };
  const analyzed = await session.dispatch({
    type: 'analyze', analyzer, transientEvidence: true, analysisInput: { photoId: 'pending-photo' },
  });
  assert.equal(analyzed.ok, true);
  const accepted = await session.dispatch({
    type: 'accept-proposal', proposalId: 'transient-proposal', selectedFields: ['hair'],
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(session.getViewModel().editor.hair.palette, { primary: '#423223', shadow: '#302419', highlight: '#64513d' });
  session.dispose();
});

test('accessible product UI exposes retained-photo, photo-free backup, and quota recovery controls', async () => {
  const [html, capture, appController] = await Promise.all([
    readFile(new URL('../../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../../src/integration/capture-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/integration/app-controller.js', import.meta.url), 'utf8'),
  ]);
  for (const id of [
    'retained-photo', 'load-retained-photo', 'export-library-backup', 'import-library-backup',
    'import-library-backup-file', 'photo-storage-recovery', 'retry-photo-save',
    'delete-unused-photos-and-retry', 'continue-without-saving-photo',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Backups do not include photos/i);
  assert.match(capture, /localPhotos\.get/);
  assert.match(appController, /createBackupController/);
});
