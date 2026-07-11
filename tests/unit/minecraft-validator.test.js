import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createMinecraftCompiler } from '../../src/compilers/minecraft/compiler.js';
import { digestBytes } from '../../src/domain/digest.js';
import {
  BASE_PARTS,
  FACE_NAMES,
  getMinecraftLayout,
  rectanglesOverlap,
} from '../../src/compilers/minecraft/layout-v1.js';
import { paintMinecraftTexture } from '../../src/compilers/minecraft/painter.js';
import { decodePngRgba, encodePngRgba } from '../../src/compilers/minecraft/png.js';

const snapshot = async () => {
  const kernel = createAvatarKernel();
  return kernel.snapshot(kernel.start().value);
};

const alphaCount = (rgba, region) => {
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      if (rgba[(y * 64 + x) * 4 + 3] !== 0) count += 1;
    }
  }
  return count;
};

const regionContainsRgb = (rgba, region, [red, green, blue]) => {
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const offset = (y * 64 + x) * 4;
      if (rgba[offset] === red && rgba[offset + 1] === green && rgba[offset + 2] === blue && rgba[offset + 3] === 255) return true;
    }
  }
  return false;
};

const concatBytes = (...arrays) => {
  const output = new Uint8Array(arrays.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const value of arrays) { output.set(value, offset); offset += value.length; }
  return output;
};

const uint32 = (value) => {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0);
  return output;
};

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes(uint32(data.length), typeBytes, data, uint32(crc32(concatBytes(typeBytes, data))));
};

const rewritePng = (png, transform) => {
  const signature = png.slice(0, 8);
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(png.slice(offset + 4, offset + 8));
    const data = png.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += length + 12;
  }
  return concatBytes(signature, ...transform(chunks).map(({ type, data }) => pngChunk(type, data)));
};

test('central layout pins independent limbs and Classic/Slim arm widths', () => {
  const classic = getMinecraftLayout({ geometry: 'classic', outerLayers: true });
  const slim = getMinecraftLayout({ geometry: 'slim', outerLayers: true });

  assert.equal(classic.parts.rightArm.faces.front.width, 4);
  assert.equal(classic.parts.leftArm.faces.front.width, 4);
  assert.equal(slim.parts.rightArm.faces.front.width, 3);
  assert.equal(slim.parts.leftArm.faces.front.width, 3);
  for (const layout of [classic, slim]) {
    for (const face of FACE_NAMES) {
      assert.equal(rectanglesOverlap(
        layout.parts.rightArm.faces[face],
        layout.parts.leftArm.faces[face],
      ), false);
      assert.equal(rectanglesOverlap(
        layout.parts.rightLeg.faces[face],
        layout.parts.leftLeg.faces[face],
      ), false);
    }
  }
});

test('separately authored UV oracle matches default semantic colors', async () => {
  const rgba = paintMinecraftTexture(await snapshot(), { geometry: 'classic', outerLayers: true });
  const oracle = [
    { label: 'head front', x: 8, y: 8, rgba: [0xc9, 0x8e, 0x68, 0xff] },
    { label: 'hat top', x: 40, y: 0, rgba: [0x65, 0x43, 0x33, 0xff] },
    { label: 'torso front', x: 20, y: 20, rgba: [0x37, 0x6c, 0x80, 0xff] },
    { label: 'right arm front', x: 44, y: 20, rgba: [0x37, 0x6c, 0x80, 0xff] },
    { label: 'left arm front', x: 36, y: 52, rgba: [0x37, 0x6c, 0x80, 0xff] },
    { label: 'right leg front', x: 4, y: 20, rgba: [0x31, 0x46, 0x59, 0xff] },
    { label: 'left leg front', x: 20, y: 52, rgba: [0x31, 0x46, 0x59, 0xff] },
  ];
  for (const expected of oracle) {
    const offset = (expected.y * 64 + expected.x) * 4;
    assert.deepEqual(Array.from(rgba.slice(offset, offset + 4)), expected.rgba, expected.label);
  }
});

test('painter fills every required base face and leaves unused pixels transparent', async () => {
  const current = await snapshot();
  for (const geometry of ['classic', 'slim']) {
    const layout = getMinecraftLayout({ geometry, outerLayers: true });
    const rgba = paintMinecraftTexture(current, { geometry, outerLayers: true });
    assert.equal(rgba.length, 64 * 64 * 4);
    for (const part of BASE_PARTS) {
      for (const face of FACE_NAMES) {
        const region = layout.parts[part].faces[face];
        assert.equal(alphaCount(rgba, region), region.width * region.height, `${geometry} ${part}.${face}`);
      }
    }
    assert.equal(rgba[(47 * 64 + 63) * 4 + 3], 0);
  }
});

test('hair is painted on the hat layer and never into the base head', async () => {
  const current = await snapshot();
  const layout = getMinecraftLayout({ geometry: 'classic', outerLayers: true });
  const rgba = paintMinecraftTexture(current, { geometry: 'classic', outerLayers: true });
  const hair = [0x42, 0x2a, 0x1f];

  assert.equal(FACE_NAMES.some((face) => regionContainsRgb(rgba, layout.parts.hat.faces[face], hair)), true);
  assert.equal(FACE_NAMES.some((face) => regionContainsRgb(rgba, layout.parts.head.faces[face], hair)), false);
});

test('outer clothing uses aligned regions and honors the profile toggle', async () => {
  const current = await snapshot();
  const layout = getMinecraftLayout({ geometry: 'classic', outerLayers: true });
  const withOuter = paintMinecraftTexture(current, { geometry: 'classic', outerLayers: true });
  const withoutOuter = paintMinecraftTexture(current, { geometry: 'classic', outerLayers: false });

  for (const [base, outer] of [
    ['body', 'jacket'],
    ['rightArm', 'rightSleeve'],
    ['leftArm', 'leftSleeve'],
    ['rightLeg', 'rightPants'],
    ['leftLeg', 'leftPants'],
  ]) {
    for (const face of FACE_NAMES) {
      assert.equal(layout.parts[base].faces[face].width, layout.parts[outer].faces[face].width);
      assert.equal(layout.parts[base].faces[face].height, layout.parts[outer].faces[face].height);
      assert.ok(alphaCount(withOuter, layout.parts[outer].faces[face]) > 0);
      assert.equal(alphaCount(withoutOuter, layout.parts[outer].faces[face]), 0);
    }
  }
});

test('preflight accepts complete output and rejects corrupted PNG bytes', async () => {
  const current = await snapshot();
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: current,
    profile: { geometry: 'classic', outerLayers: true },
  });
  assert.equal(compiled.ok, true);
  const report = await compiler.preflight(compiled.value);
  assert.equal(report.passed, true);
  assert.equal(report.checks.every((check) => check.passed), true);

  const corrupt = structuredClone(compiled.value);
  corrupt.artifacts[0].bytes[20] ^= 0xff;
  const failed = await compiler.preflight(corrupt);
  assert.equal(failed.passed, false);
  assert.equal(failed.checks.some((check) => !check.passed), true);

  const slim = await compiler.compile({
    snapshot: current,
    profile: { geometry: 'slim', outerLayers: true },
  });
  assert.equal((await compiler.preflight(slim.value)).passed, true);
});

test('preflight rejects a bundle relabeled as the Roblox compiler', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const relabeled = structuredClone(compiled.value);
  relabeled.compiler = 'roblox-classic-v1';

  const report = await compiler.preflight(relabeled);
  assert.equal(report.passed, false);
  assert.equal(report.checks.some((item) => item.id === 'compiler' && !item.passed), true);
});

test('preflight rejects a validly encoded and digested partial required face', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const partial = structuredClone(compiled.value);
  const decoded = decodePngRgba(partial.artifacts[0].bytes);
  const front = getMinecraftLayout({ geometry: 'classic' }).parts.head.faces.front;
  for (let y = front.y; y < front.y + front.height; y += 1) {
    for (let x = front.x; x < front.x + front.width; x += 1) {
      decoded.rgba.fill(0, (y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
    }
  }
  partial.artifacts[0].bytes = encodePngRgba(64, 64, decoded.rgba);
  partial.artifacts[0].pixelDigest = await digestBytes(decoded.rgba);

  const report = await compiler.preflight(partial);
  assert.equal(report.passed, false);
  assert.equal(report.checks.find(({ id }) => id === 'pixel-digest').passed, true);
  assert.equal(report.checks.find(({ id }) => id === 'required-regions').passed, false);
});

test('preflight requires exactly one Minecraft artifact and rejects private additions', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const withPrivatePhoto = structuredClone(compiled.value);
  withPrivatePhoto.artifacts.push({
    filename: 'private-photo.jpg',
    mediaType: 'image/jpeg',
    bytes: new Uint8Array([1, 2, 3]),
  });

  const report = await compiler.preflight(withPrivatePhoto);
  assert.equal(report.passed, false);
  assert.equal(report.checks.some(({ id, passed }) => id === 'artifact-count' && !passed), true);
});

test('preflight rejects missing hair and partial enabled outer clothing', async () => {
  const current = await snapshot();
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: current,
    profile: { geometry: 'classic', outerLayers: true },
  });
  const layout = getMinecraftLayout({ geometry: 'classic' });

  const withoutHair = structuredClone(compiled.value);
  const hairRgba = decodePngRgba(withoutHair.artifacts[0].bytes).rgba;
  for (const face of FACE_NAMES) {
    const region = layout.parts.hat.faces[face];
    for (let y = region.y; y < region.y + region.height; y += 1) {
      for (let x = region.x; x < region.x + region.width; x += 1) hairRgba.fill(0, (y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
    }
  }
  withoutHair.artifacts[0].bytes = encodePngRgba(64, 64, hairRgba);
  withoutHair.artifacts[0].pixelDigest = await digestBytes(hairRgba);
  const hairReport = await compiler.preflight(withoutHair);
  assert.equal(hairReport.checks.find(({ id }) => id === 'hair-layer').passed, false);

  const partialOuter = structuredClone(compiled.value);
  const outerRgba = decodePngRgba(partialOuter.artifacts[0].bytes).rgba;
  const sleeveFront = layout.parts.rightSleeve.faces.front;
  for (let y = sleeveFront.y; y < sleeveFront.y + sleeveFront.height; y += 1) {
    for (let x = sleeveFront.x; x < sleeveFront.x + sleeveFront.width; x += 1) outerRgba.fill(0, (y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
  }
  partialOuter.artifacts[0].bytes = encodePngRgba(64, 64, outerRgba);
  partialOuter.artifacts[0].pixelDigest = await digestBytes(outerRgba);
  const outerReport = await compiler.preflight(partialOuter);
  assert.equal(outerReport.checks.find(({ id }) => id === 'outer-regions').passed, false);
});

test('preflight rejects private ancillary chunks even with valid PNG CRC', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const privatePng = structuredClone(compiled.value);
  privatePng.artifacts[0].bytes = rewritePng(privatePng.artifacts[0].bytes, (chunks) => {
    const iend = chunks.findIndex(({ type }) => type === 'IEND');
    return [
      ...chunks.slice(0, iend),
      { type: 'tEXt', data: new TextEncoder().encode('private-photo=child-bytes') },
      ...chunks.slice(iend),
    ];
  });

  const report = await compiler.preflight(privatePng);
  assert.equal(report.passed, false);
  assert.match(report.checks.find(({ id }) => id === 'decode').message, /chunk|IHDR.*IDAT.*IEND/i);
});

test('preflight rejects a valid-CRC IEND carrying private bytes', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const privateTerminator = structuredClone(compiled.value);
  privateTerminator.artifacts[0].bytes = rewritePng(
    privateTerminator.artifacts[0].bytes,
    (chunks) => chunks.map((chunk) => (
      chunk.type === 'IEND'
        ? { type: 'IEND', data: new TextEncoder().encode('private-child-bytes') }
        : chunk
    )),
  );

  const report = await compiler.preflight(privateTerminator);
  assert.equal(report.passed, false);
  assert.match(report.checks.find(({ id }) => id === 'decode').message, /IEND.*zero|zero.*IEND/i);
});

test('preflight rejects bytes after the final DEFLATE block before Adler-32', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const trailingBlock = structuredClone(compiled.value);
  trailingBlock.artifacts[0].bytes = rewritePng(trailingBlock.artifacts[0].bytes, (chunks) => chunks.map((chunk) => {
    if (chunk.type !== 'IDAT') return chunk;
    const adlerOffset = chunk.data.length - 4;
    return {
      type: 'IDAT',
      data: concatBytes(
        chunk.data.slice(0, adlerOffset),
        new Uint8Array([0x00, 0x00, 0x00, 0xff, 0xff]),
        chunk.data.slice(adlerOffset),
      ),
    };
  }));

  const report = await compiler.preflight(trailingBlock);
  assert.equal(report.passed, false);
  assert.match(report.checks.find(({ id }) => id === 'decode').message, /final|trailing|Adler/i);
});

test('preflight requires exact IHDR methods and zlib header bytes', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  const mutations = [
    {
      label: 'IHDR compression method',
      mutate: (chunks) => chunks.map((chunk) => {
        if (chunk.type !== 'IHDR') return chunk;
        const data = chunk.data.slice(); data[10] = 1; return { ...chunk, data };
      }),
    },
    {
      label: 'IHDR filter method',
      mutate: (chunks) => chunks.map((chunk) => {
        if (chunk.type !== 'IHDR') return chunk;
        const data = chunk.data.slice(); data[11] = 1; return { ...chunk, data };
      }),
    },
    {
      label: 'zlib FLG',
      mutate: (chunks) => chunks.map((chunk) => {
        if (chunk.type !== 'IDAT') return chunk;
        const data = chunk.data.slice(); data[1] = 0x9c; return { ...chunk, data };
      }),
    },
  ];

  for (const mutation of mutations) {
    const changed = structuredClone(compiled.value);
    changed.artifacts[0].bytes = rewritePng(changed.artifacts[0].bytes, mutation.mutate);
    const report = await compiler.preflight(changed);
    assert.equal(report.passed, false, mutation.label);
    assert.match(report.checks.find(({ id }) => id === 'decode').message, /IHDR|compression|filter|zlib|0x78|0x01/i);
  }
});

test('preflight verifies declared PNG media type and dimensions', async () => {
  const compiler = createMinecraftCompiler();
  const compiled = await compiler.compile({
    snapshot: await snapshot(),
    profile: { geometry: 'classic', outerLayers: true },
  });
  for (const mutate of [
    (artifact) => { artifact.mediaType = 'application/octet-stream'; },
    (artifact) => { artifact.width = 32; },
    (artifact) => { artifact.height = 32; },
  ]) {
    const dishonest = structuredClone(compiled.value);
    mutate(dishonest.artifacts[0]);
    const report = await compiler.preflight(dishonest);
    assert.equal(report.passed, false);
    assert.equal(report.checks.some(({ id, passed }) => id === 'artifact-metadata' && !passed), true);
  }
});

test('every valid semantic appearance control materially affects decoded pixels', async () => {
  const kernel = createAvatarKernel();
  const compiler = createMinecraftCompiler();
  const baseFrame = kernel.start().value;
  const compileOperations = async (operations) => {
    const frame = operations.length
      ? kernel.transact({ frame: baseFrame, baseRevision: 1, operations }).value
      : baseFrame;
    const current = await kernel.snapshot(frame);
    return (await compiler.compile({ snapshot: current, profile: { geometry: 'classic', outerLayers: true } })).value.artifacts[0].pixelDigest;
  };
  const distinct = async (operationSets) => {
    const digests = await Promise.all(operationSets.map(compileOperations));
    assert.equal(new Set(digests).size, digests.length, digests.join(','));
  };

  await distinct([
    [{ op: 'set-hair', value: { style: 'crop', volume: 2 } }],
    [{ op: 'set-hair', value: { style: 'curl', volume: 2 } }],
    [{ op: 'set-hair', value: { style: 'sweep', volume: 2 } }],
    [{ op: 'set-hair', value: { style: 'long', volume: 2 } }],
  ]);
  await distinct([
    [{ op: 'set-hair', value: { style: 'curl', volume: 1 } }],
    [{ op: 'set-hair', value: { style: 'curl', volume: 2 } }],
    [{ op: 'set-hair', value: { style: 'curl', volume: 3 } }],
  ]);
  await distinct([
    [],
    [{ op: 'set-expression', value: 'neutral' }],
    [{ op: 'set-expression', value: 'grin' }],
  ]);
  await distinct([
    [],
    [{ op: 'set-accessories', value: [{ kind: 'glasses', color: '#112233' }] }],
    [{ op: 'set-accessories', value: [{ kind: 'beard', color: '#112233' }] }],
  ]);
  await distinct([
    [],
    [{ op: 'set-style', value: { shading: 'soft', outline: false } }],
    [{ op: 'set-style', value: { shading: 'block', outline: true } }],
  ]);

  const defaultSnapshot = await kernel.snapshot(baseFrame);
  const outerwearSnapshot = structuredClone(defaultSnapshot);
  outerwearSnapshot.semanticAppearance.outfit.outerwear = true;
  const defaultDigest = (await compiler.compile({ snapshot: defaultSnapshot, profile: { geometry: 'classic', outerLayers: true } })).value.artifacts[0].pixelDigest;
  const outerwearDigest = (await compiler.compile({ snapshot: outerwearSnapshot, profile: { geometry: 'classic', outerLayers: true } })).value.artifacts[0].pixelDigest;
  assert.notEqual(defaultDigest, outerwearDigest);
});
