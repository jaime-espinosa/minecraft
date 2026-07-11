import test from 'node:test';
import assert from 'node:assert/strict';

import { createPhotoNormalizer } from '../../src/identity-library/photo-normalizer.js';

const harness = ({ width = 4000, height = 2000, hasAlpha = false, failAt = null, abortAt = null, signal = { aborted: false } } = {}) => {
  const calls = [], stored = [];
  const resource = (name, value = {}) => ({ name, ...value });
  const deps = {
    decode: async () => { calls.push('decode'); if (failAt === 'decode') throw new Error('decode'); if (abortAt === 'decode') signal.aborted = true; return resource('decoded', { width, height, hasAlpha }); },
    orient: async (decoded) => { calls.push('orient'); if (abortAt === 'orient') signal.aborted = true; return resource('oriented', decoded); },
    createCanvas: (w, h) => { calls.push(['canvas', w, h]); return resource('canvas', { width: w, height: h }); },
    draw: async () => { calls.push('draw'); if (abortAt === 'draw') signal.aborted = true; },
    encode: async (canvas, options) => { calls.push(['encode', options]); if (failAt === 'encode') throw new Error('encode'); if (abortAt === 'encode') signal.aborted = true; return new Blob(['normalized'], { type: options.mimeType }); },
    digest: async () => { if (abortAt === 'digest' || abortAt === 'before-store') signal.aborted = true; return 'd'.repeat(64); }, createObjectURL: () => { calls.push('url'); return 'blob:preview'; },
    revokeObjectURL: (url) => calls.push(['revoke', url]), release: (value) => calls.push(['release', value?.name ?? 'source']),
    stageNormalizedPhoto: async (envelope, options) => { calls.push(['stage', options?.signal]); if (failAt === 'store') throw new Error('store'); if (abortAt === 'store') signal.aborted = true; return { commit: async () => { calls.push('commit'); stored.push(envelope); }, rollback: async () => { stored.splice(0); calls.push('rollback'); } }; },
    createId: () => 'photo-1', clock: () => '2026-07-11T00:00:00.000Z', normalizationVersion: 'normalize-v1',
  };
  return { normalizer: createPhotoNormalizer(deps), calls, stored, signal };
};

test('bounds dimensions and encodes photographs as JPEG 0.92', async () => {
  const { normalizer, calls, stored } = harness();
  const result = await normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1, 2]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 1 }, signal: { aborted: false } });
  assert.equal(result.ok, true); assert.deepEqual(calls.find((call) => Array.isArray(call) && call[0] === 'canvas'), ['canvas', 2048, 1024]);
  const encodeOptions = calls.find((call) => Array.isArray(call) && call[0] === 'encode')[1];
  assert.equal(encodeOptions.mimeType, 'image/jpeg'); assert.equal(encodeOptions.quality, .92); assert.equal(encodeOptions.signal.aborted, false);
  assert.deepEqual(Object.keys(stored[0]), ['metadata', 'blob']);
  assert.equal(stored[0].metadata.pixelDigest, 'd'.repeat(64)); assert.equal(stored[0].metadata.focusRegion.size, 1);
  assert.doesNotMatch(JSON.stringify(stored[0].metadata), /filename|path|raw|mask|thumbnail|analyzer/i);
});

test('alpha sources use PNG and persistence requires explicit confirmed role', async () => {
  const alpha = harness({ width: 800, height: 1200, hasAlpha: true });
  assert.equal((await alpha.normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'hair-detail', focusRegion: { centerX: 0, centerY: 1, size: 0 } })).ok, true);
  assert.equal(alpha.stored[0].metadata.mimeType, 'image/png');
  const cancelled = harness();
  const result = await cancelled.normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: false, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 1 } });
  assert.equal(result.fault.kind, 'cancelled'); assert.equal(cancelled.stored.length, 0); assert.ok(cancelled.calls.some((call) => Array.isArray(call) && call[0] === 'release'));
});

test('releases transient resources and object URLs on success and every failure', async () => {
  for (const failAt of [null, 'decode', 'encode', 'store']) {
    const { normalizer, calls } = harness({ failAt });
    await normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 1 } });
    assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'release'));
    if (calls.includes('url')) assert.ok(calls.some((call) => Array.isArray(call) && call[0] === 'revoke'));
  }
});

test('abort before or during every async stage persists nothing and releases everything', async () => {
  for (const abortAt of ['before', 'decode', 'orient', 'draw', 'encode', 'digest', 'before-store', 'store']) {
    const signal = { aborted: abortAt === 'before' }; const current = harness({ abortAt, signal });
    const result = await current.normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 1 }, signal });
    assert.equal(result.fault.kind, 'cancelled', abortAt); assert.deepEqual(current.stored, [], abortAt);
    assert.ok(current.calls.some((call) => Array.isArray(call) && call[0] === 'release'), abortAt);
  }
});

test('staging contract is mandatory and an ordinary success Result can never claim persistence', async () => {
  let committed = false;
  const current = harness();
  current.normalizer = createPhotoNormalizer({
    decode: async () => ({ width: 1, height: 1, hasAlpha: false }), orient: async (value) => value,
    createCanvas: () => ({}), draw: async () => {}, encode: async () => new Blob(['x'], { type: 'image/jpeg' }),
    digest: async () => 'd'.repeat(64), release: () => {}, createId: () => 'id', clock: () => '2026-07-11T00:00:00.000Z', normalizationVersion: 'v1',
    stageNormalizedPhoto: async () => ({ ok: true, value: { commit: async () => { committed = true; } } }),
  });
  const result = await current.normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 0 }, signal: { aborted: false } });
  assert.equal(result.fault.kind, 'storage-contract'); assert.equal(committed, false);
});

test('late abort after mandatory staging calls rollback and never commit', async () => {
  const signal = { aborted: false }; let commits = 0, rollbacks = 0;
  const normalizer = createPhotoNormalizer({
    decode: async () => ({ width: 1, height: 1, hasAlpha: false }), orient: async (value) => value,
    createCanvas: () => ({}), draw: async () => {}, encode: async () => new Blob(['x'], { type: 'image/jpeg' }),
    digest: async () => 'd'.repeat(64), release: () => {}, createId: () => 'id', clock: () => '2026-07-11T00:00:00.000Z', normalizationVersion: 'v1',
    stageNormalizedPhoto: async () => { signal.aborted = true; return { commit: async () => { commits += 1; }, rollback: async () => { rollbacks += 1; } }; },
  });
  const result = await normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 0 }, signal });
  assert.equal(result.fault.kind, 'cancelled'); assert.equal(commits, 0); assert.equal(rollbacks, 1);
});

test('commit rejection rolls staged persistence back exactly once', async () => {
  let persisted = false, rollbacks = 0;
  const normalizer = createPhotoNormalizer({
    decode: async () => ({ width: 1, height: 1, hasAlpha: false }), orient: async (value) => value,
    createCanvas: () => ({}), draw: async () => {}, encode: async () => new Blob(['x'], { type: 'image/jpeg' }),
    digest: async () => 'd'.repeat(64), release: () => {}, createId: () => 'id', clock: () => '2026-07-11T00:00:00.000Z', normalizationVersion: 'v1',
    stageNormalizedPhoto: async () => ({ commit: async () => { persisted = true; throw new Error('commit failed'); }, rollback: async () => { rollbacks += 1; persisted = false; } }),
  });
  const result = await normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 0 } });
  assert.equal(result.fault.kind, 'normalization-failed'); assert.equal(persisted, false); assert.equal(rollbacks, 1);
});

test('rollback rejection stays a typed normalization failure and is attempted once', async () => {
  let rollbacks = 0; const signal = { aborted: false };
  const normalizer = createPhotoNormalizer({
    decode: async () => ({ width: 1, height: 1, hasAlpha: false }), orient: async (value) => value,
    createCanvas: () => ({}), draw: async () => {}, encode: async () => new Blob(['x'], { type: 'image/jpeg' }),
    digest: async () => 'd'.repeat(64), release: () => {}, createId: () => 'id', clock: () => '2026-07-11T00:00:00.000Z', normalizationVersion: 'v1',
    stageNormalizedPhoto: async () => { signal.aborted = true; return { commit: async () => {}, rollback: async () => { rollbacks += 1; throw new Error('rollback failed'); } }; },
  });
  const result = await normalizer.normalizeAndStore({ sourceBytes: new Uint8Array([1]), confirmed: true, role: 'face-front', focusRegion: { centerX: .5, centerY: .5, size: 0 }, signal });
  assert.equal(result.fault.kind, 'normalization-failed'); assert.match(result.fault.message, /rollback/i); assert.equal(rollbacks, 1);
});
