import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { inflateSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { validateArtifactBundleV1 } from '../../src/domain/contracts.js';
import { digestBytes } from '../../src/domain/digest.js';
import { createMinecraftCompiler } from '../../src/compilers/minecraft/compiler.js';
import { paintMinecraftTexture } from '../../src/compilers/minecraft/painter.js';
import { decodePngRgba, inspectPngChunks } from '../../src/compilers/minecraft/png.js';
import { encodePngRgba } from '../../src/compilers/minecraft/png.js';

const createSnapshot = async () => {
  const kernel = createAvatarKernel();
  return kernel.snapshot(kernel.start().value);
};

const GOLDEN_DIGESTS = {
  classic: '1758595d9c711873cb91572ac65811858ff71e62a6f429fc3662164a1a7e2e8b',
  slim: 'f0050672e196f7ac8913d91a7abc26c8a866fdb1faaa087ac100673467359ac3',
};

const loadRgbaGolden = async (geometry) => {
  const text = await readFile(
    new URL(`../fixtures/minecraft/${geometry}-v1.rgba-deflate-base64.txt`, import.meta.url),
    'utf8',
  );
  const encoded = text.split('\n').filter((line) => line && !line.startsWith('#')).join('');
  return new Uint8Array(inflateRawSync(Buffer.from(encoded, 'base64')));
};

// Independent standards check: parse PNG chunks here and delegate only zlib decoding to Node.
// This deliberately does not import or call the runtime PNG decoder.
const decodeWithNodeZlib = (png) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  let width;
  let height;
  const compressed = [];
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(png.slice(offset + 4, offset + 8));
    const data = png.slice(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
    }
    if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  const joined = Buffer.concat(compressed.map((bytes) => Buffer.from(bytes)));
  const scanlines = inflateSync(joined);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    assert.equal(scanlines[start], 0);
    rgba.set(scanlines.subarray(start + 1, start + 1 + width * 4), y * width * 4);
  }
  return { width, height, rgba };
};

test('compile emits the pinned deterministic Minecraft artifact bundle', async () => {
  const snapshot = await createSnapshot();
  const compiler = createMinecraftCompiler();
  const profile = { geometry: 'classic', outerLayers: true };

  const first = await compiler.compile({ snapshot, profile });
  const second = await compiler.compile({ snapshot, profile });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.doesNotThrow(() => validateArtifactBundleV1(first.value));
  assert.equal(first.value.compiler, 'minecraft-v1');
  assert.equal(first.value.sourceDigest, snapshot.sourceDigest);
  assert.equal(first.value.artifacts.length, 1);
  const artifact = first.value.artifacts[0];
  assert.equal(artifact.filename, 'my-avatar-minecraft.png');
  assert.equal(artifact.mediaType, 'image/png');
  assert.equal(artifact.width, 64);
  assert.equal(artifact.height, 64);
  assert.match(artifact.pixelDigest, /^[0-9a-f]{64}$/);
  assert.deepEqual(artifact.bytes, second.value.artifacts[0].bytes);
  assert.equal(artifact.pixelDigest, second.value.artifacts[0].pixelDigest);
  assert.deepEqual(inspectPngChunks(artifact.bytes), ['IHDR', 'IDAT', 'IEND']);
});

test('PNG decode agrees with the authoritative preview RGBA for every byte', async () => {
  const snapshot = await createSnapshot();
  const profile = { geometry: 'slim', outerLayers: true };
  const expectedPreview = paintMinecraftTexture(snapshot, profile);
  const result = await createMinecraftCompiler().compile({ snapshot, profile });

  assert.equal(result.ok, true);
  const decoded = decodePngRgba(result.value.artifacts[0].bytes);
  assert.equal(decoded.width, 64);
  assert.equal(decoded.height, 64);
  assert.equal(decoded.rgba.length, 64 * 64 * 4);
  assert.deepEqual(decoded.rgba, expectedPreview);
  assert.deepEqual(decodeWithNodeZlib(result.value.artifacts[0].bytes), decoded);
});

test('PNG helpers accept genuine cross-realm Uint8Array values', async () => {
  const snapshot = await createSnapshot();
  const rgba = paintMinecraftTexture(snapshot, { geometry: 'classic', outerLayers: true });
  const crossRealmRgba = runInNewContext('Uint8Array.from(value)', { value: rgba });
  const png = encodePngRgba(64, 64, crossRealmRgba);
  const crossRealmPng = runInNewContext('Uint8Array.from(value)', { value: png });
  assert.deepEqual(decodePngRgba(crossRealmPng).rgba, rgba);
});

test('Classic and Slim decoded RGBA match pinned reviewed v1 regression goldens', async () => {
  const snapshot = await createSnapshot();
  const compiler = createMinecraftCompiler();
  for (const geometry of ['classic', 'slim']) {
    const result = await compiler.compile({
      snapshot,
      profile: { geometry, outerLayers: true },
    });
    assert.equal(result.ok, true);
    const decoded = decodePngRgba(result.value.artifacts[0].bytes).rgba;
    const golden = await loadRgbaGolden(geometry);
    assert.equal(golden.length, 64 * 64 * 4);
    assert.deepEqual(decoded, golden);
    assert.equal(await digestBytes(golden), GOLDEN_DIGESTS[geometry]);
    assert.equal(result.value.artifacts[0].pixelDigest, GOLDEN_DIGESTS[geometry]);
  }
});

test('compile isolates invalid snapshot and profile faults', async () => {
  const snapshot = await createSnapshot();
  const compiler = createMinecraftCompiler();
  const invalidSnapshot = { ...snapshot, photoPixels: new Uint8Array([1]) };

  const snapshotResult = await compiler.compile({
    snapshot: invalidSnapshot,
    profile: { geometry: 'classic', outerLayers: true },
  });
  const profileResult = await compiler.compile({
    snapshot,
    profile: { geometry: 'wide', outerLayers: true },
  });

  assert.equal(snapshotResult.ok, false);
  assert.equal(snapshotResult.fault.kind, 'invalid-snapshot');
  assert.equal(profileResult.ok, false);
  assert.equal(profileResult.fault.kind, 'invalid-profile');
});

test('compile rejects closed-envelope privacy fields without invoking accessors', async () => {
  const snapshot = await createSnapshot();
  const compiler = createMinecraftCompiler();
  const profile = { geometry: 'classic', outerLayers: true };
  const hiddenPhotoInput = { snapshot, profile };
  Object.defineProperty(hiddenPhotoInput, 'photoPixels', {
    value: new Uint8Array([1]),
    enumerable: false,
  });
  let getterCalled = false;
  const accessorInput = { profile };
  Object.defineProperty(accessorInput, 'snapshot', {
    enumerable: true,
    get() { getterCalled = true; return snapshot; },
  });

  for (const input of [{ snapshot, profile, photoPixels: new Uint8Array([1]) }, hiddenPhotoInput, accessorInput]) {
    const result = await compiler.compile(input);
    assert.equal(result.ok, false);
    assert.equal(result.fault.kind, 'invalid-snapshot');
  }
  assert.equal(getterCalled, false);
});
