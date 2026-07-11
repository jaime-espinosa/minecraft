import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { applyMigrationWithBackup, openDatabase, requestResult, transactionDone } from '../../src/identity-library/database.js';
import { createFakeIndexedDB } from '../support/fake-indexeddb.js';

const seedV1 = async (indexedDB, name) => {
  const opened = await openDatabase({ indexedDB, name, version: 1 });
  const tx = opened.value.transaction(['meta', 'recipes'], 'readwrite');
  tx.objectStore('meta').put({ key: 'library', libraryId: 'old', schemaVersion: 1 });
  tx.objectStore('recipes').put({ id: 'avatar-1', revision: 1 });
  await transactionDone(tx); opened.value.close();
};

test('migration backup is removed only after rewrite validation succeeds', async () => {
  const beforeFixture = JSON.parse(await readFile(new URL('../fixtures/migrations/v1-library.json', import.meta.url)));
  const expectedFixture = JSON.parse(await readFile(new URL('../fixtures/migrations/v2-library.json', import.meta.url)));
  const indexedDB = createFakeIndexedDB(), name = `migration-${crypto.randomUUID()}`; await seedV1(indexedDB, name);
  const opened = await openDatabase({ indexedDB, name, version: 2, migrations: { 2: ({ transaction }) => {
    applyMigrationWithBackup(transaction, beforeFixture,
      () => transaction.objectStore('recipes').put(expectedFixture.recipes[0]),
      () => true);
  } } });
  assert.equal(opened.ok, true);
  const tx = opened.value.transaction('meta', 'readonly');
  assert.equal(await requestResult(tx.objectStore('meta').get('migration-backup')), undefined);
  await transactionDone(tx);
  const recipeTx = opened.value.transaction('recipes', 'readonly');
  assert.deepEqual(await requestResult(recipeTx.objectStore('recipes').get('avatar-1')), expectedFixture.recipes[0]);
  await transactionDone(recipeTx);
});

test('failed migration aborts and reopening the previous version preserves prior records', async () => {
  const indexedDB = createFakeIndexedDB(), name = `migration-${crypto.randomUUID()}`; await seedV1(indexedDB, name);
  const failed = await openDatabase({ indexedDB, name, version: 2, migrations: { 2: ({ transaction }) => {
    applyMigrationWithBackup(transaction, { records: ['avatar-1'] },
      () => transaction.objectStore('recipes').put({ id: 'avatar-1', revision: 2 }),
      () => false);
  } } });
  assert.equal(failed.ok, false); assert.equal(failed.fault.kind, 'migration-failed');
  const reopened = await openDatabase({ indexedDB, name, version: 1 });
  assert.equal(reopened.ok, true);
  const tx = reopened.value.transaction('recipes', 'readonly');
  assert.deepEqual(await requestResult(tx.objectStore('recipes').get('avatar-1')), { id: 'avatar-1', revision: 1 });
  await transactionDone(tx);
});

test('open connections close on versionchange so a later upgrade can complete', async () => {
  const indexedDB = createFakeIndexedDB(), name = `lifecycle-${crypto.randomUUID()}`;
  const first = await openDatabase({ indexedDB, name, version: 1 }); assert.equal(first.ok, true);
  const upgraded = await openDatabase({ indexedDB, name, version: 2 });
  assert.equal(upgraded.ok, true); assert.equal(upgraded.value.version, 2);
});

test('blocked open resolves once and closes a late successful connection', async () => {
  const listeners = new Map(); let closed = false;
  const request = { result: { close: () => { closed = true; } }, error: null, addEventListener(type, listener) { listeners.set(type, listener); } };
  const pending = openDatabase({ indexedDB: { open() { queueMicrotask(() => { listeners.get('blocked')(); queueMicrotask(() => listeners.get('success')()); }); return request; } } });
  const result = await pending; assert.equal(result.fault.kind, 'storage-blocked');
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(closed, true);
});
