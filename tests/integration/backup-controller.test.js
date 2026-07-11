import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackupController } from '../../src/integration/backup-controller.js';

const element = (overrides = {}) => {
  const listeners = new Map();
  return {
    hidden: true,
    disabled: false,
    textContent: '',
    files: [],
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type) { return listeners.get(type)?.(); },
    ...overrides,
  };
};

test('backup controller offers separately confirmed restore-as-new-person only after ordinary foreign import rejection', async () => {
  const nodes = {
    '#export-library-backup': element(),
    '#import-library-backup-file': element({ files: [{ text: async () => '{"backup":true}' }] }),
    '#import-library-backup': element(),
    '#download-library-backup': element(),
    '#library-backup-status': element(),
  };
  const prompts = [];
  const calls = [];
  let reloaded = 0;
  const controller = createBackupController({
    document: { querySelector(selector) { return nodes[selector]; } },
    libraryBackups: {
      async export() { throw new Error('not used'); },
      async import(input, options) { calls.push(['import', input, options]); return { ok: false, fault: { kind: 'foreign-library', message: 'foreign' } }; },
      async restoreAsNewPerson(input, options) { calls.push(['restore', input, options]); return { ok: true, value: undefined }; },
    },
    confirm(message) { prompts.push(message); return true; },
    urlApi: { createObjectURL() {}, revokeObjectURL() {} },
    reload() { reloaded += 1; },
  });

  await nodes['#import-library-backup'].emit('click');

  assert.deepEqual(calls, [
    ['import', '{"backup":true}', { confirmed: true }],
    ['restore', '{"backup":true}', { confirmed: true }],
  ]);
  assert.equal(prompts.length, 2);
  assert.notEqual(prompts[0], prompts[1]);
  assert.match(prompts[1], /new person|different local library|disaster recovery/i);
  assert.equal(reloaded, 1);
  controller.dispose();
});

test('backup controller does not restore a foreign backup when the separate destructive confirmation is rejected', async () => {
  const nodes = {
    '#export-library-backup': element(),
    '#import-library-backup-file': element({ files: [{ text: async () => '{}' }] }),
    '#import-library-backup': element(),
    '#download-library-backup': element(),
    '#library-backup-status': element(),
  };
  let restoreCalls = 0;
  const confirmations = [true, false];
  const controller = createBackupController({
    document: { querySelector(selector) { return nodes[selector]; } },
    libraryBackups: {
      async export() { throw new Error('not used'); },
      async import() { return { ok: false, fault: { kind: 'foreign-library', message: 'foreign' } }; },
      async restoreAsNewPerson() { restoreCalls += 1; return { ok: true }; },
    },
    confirm() { return confirmations.shift(); },
    urlApi: { createObjectURL() {}, revokeObjectURL() {} },
    reload() { throw new Error('must not reload'); },
  });

  await nodes['#import-library-backup'].emit('click');
  assert.equal(restoreCalls, 0);
  controller.dispose();
});
