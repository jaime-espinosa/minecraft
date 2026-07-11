import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

import { analyzePaletteV1, classifyPaletteQualityV1 } from '../../src/identity-analyzer/palette-analyzer-v1.js';

const pixels = (paint) => {
  const rgba = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    const [r, g, b, a = 255] = paint(x, y); const offset = (y * 32 + x) * 4;
    rgba.set([r, g, b, a], offset);
  }
  return rgba;
};
const input = (role, rgba, overrides = {}) => ({ role, rgba, width: 32, height: 32, focusRegion: { centerX: .5, centerY: .5, size: 1 }, photoId: 'photo-1', baseIdentityRevision: 7, faceDetectorAvailable: true, createId: () => 'proposal-1', ...overrides });

test('uses the exact centered ellipse, 16-bucket midpoint, RGB tie-break, and palette math', () => {
  const rgba = pixels((x, y) => {
    const ellipse = ((x + .5 - 16) / (32 * .42)) ** 2 + ((y + .5 - 16) / (32 * .46)) ** 2 <= 1;
    if (!ellipse) return [0, 0, 255];
    return x < 16 ? [255, 0, 0] : [0, 255, 0];
  });
  const result = analyzePaletteV1(input('face-front', rgba));
  assert.equal(result.ok, true); assert.equal(result.value.baseIdentityRevision, 7);
  assert.deepEqual(result.value.evidencePhotoIds, ['photo-1']);
  assert.deepEqual(result.value.operations.map(({ field }) => field), ['complexion']);
  assert.deepEqual(result.value.operations[0].value, { primary: '#08f808', shadow: '#06b306', highlight: '#34f934' });
});

test('outfit half-open row zones map only to top, bottom, and footwear', () => {
  const rgba = pixels((x, y) => y < 2 ? [255, 255, 255, 0] : y < 14 ? [32, 64, 96] : y < 26 ? [96, 128, 160] : [160, 192, 224]);
  const result = analyzePaletteV1(input('outfit-front', rgba));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.operations.map(({ field, value }) => [field, value.primary]), [['top', '#284868'], ['bottom', '#6888a8'], ['footwear', '#a8c8e8']]);
  assert.ok(result.value.operations.every(({ provenance }) => provenance.source === 'photo-analysis'));
});

test('warning thresholds and confidence bands are deterministic', () => {
  const uniform = analyzePaletteV1(input('hair-detail', pixels(() => [100, 100, 100]))).value;
  assert.ok(uniform.warnings.includes('blur'));
  const dark = analyzePaletteV1(input('hair-detail', pixels((x, y) => [x % 2 ? 30 : 40, 30, 30]))).value;
  assert.ok(dark.warnings.includes('low-light'));
  const blown = analyzePaletteV1(input('hair-detail', pixels((x, y) => x < 14 ? [255, 255, 255] : [120 + (x % 2) * 20, 100, 80]))).value;
  assert.ok(blown.warnings.includes('overexposure'));
  const sparse = analyzePaletteV1(input('hair-detail', pixels((x, y) => [120, 80, 60, (x + y) % 3 ? 0 : 255]))).value;
  assert.ok(sparse.warnings.includes('low-coverage')); assert.equal(sparse.confidence, 'low');
  const background = analyzePaletteV1(input('hair-detail', pixels((x, y) => (x === 0 || y === 0 || x === 31 || y === 31) ? [128, 64, 32] : [128 + (x % 2) * 16, 64, 32]))).value;
  assert.ok(background.warnings.includes('background-risk'));
  const detector = analyzePaletteV1(input('face-front', pixels((x, y) => [80 + x * 3, 70 + y * 2, 60]), { faceDetectorAvailable: false })).value;
  assert.ok(detector.warnings.includes('face-detector-unavailable'));
  assert.equal(detector.confidence, 'review');
});

test('supports only bounded roles and allowed fields without storage side effects', () => {
  let writes = 0;
  const unsupported = analyzePaletteV1(input('face-smile', pixels(() => [80, 90, 100]), { storage: { put() { writes += 1; } } }));
  assert.equal(unsupported.fault.kind, 'unsupported-role'); assert.equal(writes, 0);
  const hair = analyzePaletteV1(input('hair-detail', pixels((x, y) => [70 + x * 2, 60 + y, 50]))).value;
  assert.deepEqual(hair.operations.map(({ field }) => field), ['hair']);
});

test('extracts and nearest-neighbor resamples the confirmed focus square before zones', () => {
  const rgba = new Uint8ClampedArray(64 * 32 * 4);
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 64; x += 1) rgba.set(x < 32 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * 64 + x) * 4);
  const base = { role: 'hair-detail', rgba, width: 64, height: 32, photoId: 'photo-1', baseIdentityRevision: 1, faceDetectorAvailable: true };
  const left = analyzePaletteV1({ ...base, focusRegion: { centerX: .25, centerY: .5, size: .5 } });
  const right = analyzePaletteV1({ ...base, focusRegion: { centerX: .75, centerY: .5, size: .5 } });
  assert.equal(left.value.operations[0].value.primary, '#f80808');
  assert.equal(right.value.operations[0].value.primary, '#0808f8');
  const point = analyzePaletteV1({ ...base, focusRegion: { centerX: .25, centerY: .5, size: 0 } });
  assert.equal(point.ok, true); assert.ok(point.value.operations.every(({ value }) => value.primary === '#f80808'));
  const pointOutfit = analyzePaletteV1({ ...base, role: 'outfit-front', focusRegion: { centerX: .25, centerY: .5, size: 0 } });
  assert.ok(pointOutfit.value.operations.every(({ value }) => value.primary === '#f80808'));
});

test('pins every quality threshold on both sides and the two-warning review cutoff', () => {
  const quality = (overrides = {}) => classifyPaletteQualityV1({ role: 'hair-detail', coverage: .8, medianLuma: 50, overexposureRatio: .2, meanDelta: 4, borderRatio: .35, borderMatchesPrimary: true, faceDetectorAvailable: true, ...overrides });
  assert.deepEqual(quality(), { warnings: [], confidence: 'high' });
  assert.ok(quality({ meanDelta: 3.999 }).warnings.includes('blur'));
  assert.ok(quality({ medianLuma: 49.999 }).warnings.includes('low-light'));
  assert.ok(quality({ overexposureRatio: .20001 }).warnings.includes('overexposure'));
  assert.ok(quality({ coverage: .59999 }).warnings.includes('low-coverage'));
  assert.ok(quality({ borderRatio: .35001 }).warnings.includes('background-risk'));
  assert.equal(quality({ coverage: .79999 }).confidence, 'review');
  assert.equal(quality({ coverage: .6 }).confidence, 'review');
  assert.equal(quality({ coverage: .7, meanDelta: 3, medianLuma: 49 }).confidence, 'review');
  assert.equal(quality({ coverage: .7, meanDelta: 3, medianLuma: 49, overexposureRatio: .21 }).confidence, 'low');
  assert.ok(quality({ role: 'face-front', faceDetectorAvailable: false }).warnings.includes('face-detector-unavailable'));
});

test('accepts genuine cross-realm Uint8ClampedArray pixels and rejects DataView spoofing', () => {
  const rgba = runInNewContext('new Uint8ClampedArray(32 * 32 * 4).fill(128)');
  for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;
  assert.equal(analyzePaletteV1(input('hair-detail', rgba)).ok, true);
  const spoof = new DataView(new ArrayBuffer(32 * 32 * 4)); Object.defineProperty(spoof, Symbol.toStringTag, { value: 'Uint8ClampedArray' });
  assert.equal(analyzePaletteV1(input('hair-detail', spoof)).fault.kind, 'invalid-pixels');
});

test('matches SourcePhotoV1 opaque evidence IDs by requiring only a nonempty string', () => {
  const rgba = pixels(() => [100, 120, 140]);
  for (const photoId of [undefined, '']) {
    const result = analyzePaletteV1(input('hair-detail', rgba, { photoId }));
    assert.equal(result.fault.kind, 'invalid-evidence'); assert.equal(result.value, undefined);
  }
  for (const photoId of ['photo id ü', 'x'.repeat(1024)]) {
    const result = analyzePaletteV1(input('hair-detail', rgba, { photoId }));
    assert.equal(result.ok, true); assert.deepEqual(result.value.evidencePhotoIds, [photoId]);
  }
});
