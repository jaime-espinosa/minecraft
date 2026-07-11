import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

import { canonicalJson } from '../../src/domain/canonical-json.js';
import { digestBytes, digestCanonicalJson } from '../../src/domain/digest.js';
import { err, ok } from '../../src/domain/result.js';

test('canonical JSON recursively sorts object keys and preserves array order', () => {
  const value = {
    z: [{ second: 2, first: 1 }, 'last'],
    a: { beta: true, alpha: false },
  };

  assert.equal(
    canonicalJson(value),
    '{"a":{"alpha":false,"beta":true},"z":[{"first":1,"second":2},"last"]}',
  );
  assert.equal(canonicalJson({ values: [3, 1, 2] }), '{"values":[3,1,2]}');
});

test('canonical JSON rejects unsupported values, non-finite numbers, and cycles', () => {
  for (const value of [undefined, 1n, Symbol('x'), () => {}, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => canonicalJson(value), TypeError);
  }
  assert.throws(() => canonicalJson({ nested: { value: undefined } }), TypeError);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cyclic/i);

  const sparse = [];
  sparse[1] = 'present';
  assert.throws(() => canonicalJson(sparse), /sparse/i);
});

test('canonical JSON rejects non-data object keys and decorated arrays', () => {
  const symbolObject = { safe: true, [Symbol('photoBlob')]: new Uint8Array([1]) };
  assert.throws(() => canonicalJson(symbolObject), /symbol|unsupported/i);

  const hiddenObject = { safe: true };
  Object.defineProperty(hiddenObject, 'photoBytes', { value: new Uint8Array([1]) });
  assert.throws(() => canonicalJson(hiddenObject), /non-enumerable|unsupported/i);

  let getterCalled = false;
  const accessorObject = {};
  Object.defineProperty(accessorObject, 'value', {
    enumerable: true,
    get() { getterCalled = true; return 'private'; },
  });
  assert.throws(() => canonicalJson(accessorObject), /accessor|unsupported/i);
  assert.equal(getterCalled, false);

  const decorated = ['safe'];
  decorated.photoBytes = new Uint8Array([1]);
  assert.throws(() => canonicalJson(decorated), /array|unsupported/i);

  const accessorArray = ['safe'];
  Object.defineProperty(accessorArray, '0', { enumerable: true, get: () => 'private' });
  assert.throws(() => canonicalJson(accessorArray), /accessor|unsupported/i);
});

test('digest helpers return stable lowercase SHA-256 hex', async () => {
  assert.equal(
    await digestBytes(new TextEncoder().encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    await digestCanonicalJson({ b: 2, a: 1 }),
    await digestCanonicalJson({ a: 1, b: 2 }),
  );
  assert.match(await digestCanonicalJson({ a: 1 }), /^[0-9a-f]{64}$/);

  const crossRealmBytes = runInNewContext('new Uint8Array([97, 98, 99])');
  const crossRealmBuffer = runInNewContext('new Uint8Array([97, 98, 99]).buffer');
  assert.equal(
    await digestBytes(crossRealmBytes),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    await digestBytes(crossRealmBuffer),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );

  const spoofedBuffer = {
    byteLength: 3,
    [Symbol.toStringTag]: 'ArrayBuffer',
  };
  await assert.rejects(() => digestBytes(spoofedBuffer), /Uint8Array or ArrayBuffer/);

  const spoofedUint8Array = new DataView(new ArrayBuffer(3));
  Object.defineProperty(spoofedUint8Array, Symbol.toStringTag, { value: 'Uint8Array' });
  Object.defineProperty(spoofedUint8Array, 'BYTES_PER_ELEMENT', { value: 1 });
  await assert.rejects(() => digestBytes(spoofedUint8Array), /Uint8Array or ArrayBuffer/);
});

test('Result constructors preserve the discriminated union shape', () => {
  assert.deepEqual(ok(42), { ok: true, value: 42 });
  assert.deepEqual(err({ kind: 'invalid-seed' }), {
    ok: false,
    fault: { kind: 'invalid-seed' },
  });
});
