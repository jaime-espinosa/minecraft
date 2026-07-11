import { err, ok } from '../domain/result.js';

const VERSION = 'palette-v1';
const SUPPORTED = new Set(['face-front', 'hair-detail', 'outfit-front', 'outfit-detail']);
const typedArrayTag = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8ClampedArray.prototype), Symbol.toStringTag).get;
const isExactUint8ClampedArray = (value) => ArrayBuffer.isView(value) && typedArrayTag.call(value) === 'Uint8ClampedArray';
const warningOrder = ['blur', 'low-light', 'overexposure', 'low-coverage', 'background-risk', 'face-detector-unavailable'];
const quantize = (value) => Math.min(248, Math.floor(value / 16) * 16 + 8);
const hex = (rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
const luma = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;
const palette = (primary) => ({
  primary: hex(primary),
  shadow: hex(primary.map((value) => Math.max(0, Math.min(255, Math.round(value * .72))))),
  highlight: hex(primary.map((value) => Math.max(0, Math.min(255, Math.round(value + (255 - value) * .18))))),
});
const keyOf = ([r, g, b]) => (r << 16) | (g << 8) | b;
const rgbOf = (key) => [(key >> 16) & 255, (key >> 8) & 255, key & 255];

const zoneFor = (role, field, x, y) => {
  if (role === 'face-front' || role === 'hair-detail') {
    return ((x + .5 - 16) / (32 * .42)) ** 2 + ((y + .5 - 16) / (32 * .46)) ** 2 <= 1;
  }
  const row = (y + .5) / 32;
  if (field === 'top') return row >= .05 && row < .45;
  if (field === 'bottom') return row >= .45 && row < .82;
  return row >= .82 && row <= 1;
};
const fieldsFor = (role) => role === 'face-front' ? ['complexion'] : role === 'hair-detail' ? ['hair'] : ['top', 'bottom', 'footwear'];

const sampleFocus = ({ rgba, width, height, focusRegion }) => {
  if (!focusRegion || !Number.isFinite(focusRegion.centerX) || !Number.isFinite(focusRegion.centerY) || !Number.isFinite(focusRegion.size)
    || focusRegion.centerX < 0 || focusRegion.centerX > 1 || focusRegion.centerY < 0 || focusRegion.centerY > 1 || focusRegion.size < 0 || focusRegion.size > 1) {
    throw Object.assign(new Error('Analyzer focus must have normalized size.'), { kind: 'invalid-focus' });
  }
  const side = focusRegion.size * Math.min(width, height);
  const left = Math.max(0, Math.min(width - side, focusRegion.centerX * width - side / 2));
  const top = Math.max(0, Math.min(height - side, focusRegion.centerY * height - side / 2));
  const sampled = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    const sourceX = Math.max(0, Math.min(width - 1, Math.floor(left + (x + .5) * side / 32)));
    const sourceY = Math.max(0, Math.min(height - 1, Math.floor(top + (y + .5) * side / 32)));
    const sourceOffset = (sourceY * width + sourceX) * 4; sampled.set(rgba.subarray(sourceOffset, sourceOffset + 4), (y * 32 + x) * 4);
  }
  return sampled;
};

const inspect = (rgba, role, fields) => {
  const coords = [];
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) if (fields.some((field) => zoneFor(role, field, x, y))) coords.push([x, y]);
  const samples = coords.map(([x, y]) => {
    const offset = (y * 32 + x) * 4;
    return { x, y, rgba: [rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]] };
  });
  const surviving = samples.filter(({ rgba: value }) => value[3] >= 230);
  const coverage = samples.length ? surviving.length / samples.length : 0;
  const lumas = surviving.map(({ rgba: value }) => luma(value)).sort((a, b) => a - b);
  const median = lumas.length ? lumas[Math.floor(lumas.length / 2)] : 0;
  const overexposure = lumas.length ? lumas.filter((value) => value > 245).length / lumas.length : 0;
  const byCoordinate = new Map(surviving.map((sample) => [`${sample.x},${sample.y}`, sample]));
  const deltas = [];
  for (const sample of surviving) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const neighbor = byCoordinate.get(`${sample.x + dx},${sample.y + dy}`);
    if (neighbor) deltas.push(Math.abs(luma(sample.rgba) - luma(neighbor.rgba)));
  }
  const blur = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  return { coverage, median, overexposure, blur };
};

const primaryFor = (rgba, role, field) => {
  const counts = new Map();
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    if (!zoneFor(role, field, x, y)) continue;
    const offset = (y * 32 + x) * 4; if (rgba[offset + 3] < 230) continue;
    const key = keyOf([quantize(rgba[offset]), quantize(rgba[offset + 1]), quantize(rgba[offset + 2])]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return rgbOf([...counts].sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey - rightKey)[0]?.[0] ?? 0);
};

const backgroundMetrics = (rgba, primaryKeys) => {
  const counts = new Map(); let total = 0;
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    if (x !== 0 && y !== 0 && x !== 31 && y !== 31) continue;
    const offset = (y * 32 + x) * 4; if (rgba[offset + 3] < 230) continue;
    const key = keyOf([quantize(rgba[offset]), quantize(rgba[offset + 1]), quantize(rgba[offset + 2])]); counts.set(key, (counts.get(key) ?? 0) + 1); total += 1;
  }
  const winner = [...counts].sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey - rightKey)[0];
  return { borderRatio: winner && total ? winner[1] / total : 0, borderMatchesPrimary: Boolean(winner && primaryKeys.has(winner[0])) };
};

export function classifyPaletteQualityV1({ role, coverage, medianLuma, overexposureRatio, meanDelta, borderRatio, borderMatchesPrimary, faceDetectorAvailable }) {
  const warnings = new Set();
  if (meanDelta < 4) warnings.add('blur');
  if (medianLuma < 50) warnings.add('low-light');
  if (overexposureRatio > .20) warnings.add('overexposure');
  if (coverage < .60) warnings.add('low-coverage');
  if (borderRatio > .35 && borderMatchesPrimary) warnings.add('background-risk');
  if (role === 'face-front' && faceDetectorAvailable === false) warnings.add('face-detector-unavailable');
  const orderedWarnings = warningOrder.filter((warning) => warnings.has(warning));
  const confidence = coverage >= .80 && orderedWarnings.length === 0 ? 'high'
    : coverage >= .60 && orderedWarnings.filter((warning) => warning !== 'low-coverage').length <= 2 ? 'review' : 'low';
  return { warnings: orderedWarnings, confidence };
}

export function analyzePaletteV1(input) {
  try {
    if (!SUPPORTED.has(input?.role)) return err({ kind: 'unsupported-role', message: 'This photo role is reference-only.' });
    if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1 || !isExactUint8ClampedArray(input.rgba) || input.rgba.length !== input.width * input.height * 4) return err({ kind: 'invalid-pixels', message: 'PaletteAnalyzerV1 requires complete normalized RGBA.' });
    if (!Number.isInteger(input.baseIdentityRevision) || input.baseIdentityRevision < 1) return err({ kind: 'invalid-revision', message: 'An explicit identity revision is required.' });
    if (typeof input.photoId !== 'string' || input.photoId.length === 0) return err({ kind: 'invalid-evidence', message: 'A nonempty opaque photo ID is required.' });
    const sampled = sampleFocus(input);
    const fields = fieldsFor(input.role); const metrics = inspect(sampled, input.role, fields);
    const primaries = new Map(fields.map((field) => [field, primaryFor(sampled, input.role, field)]));
    const border = backgroundMetrics(sampled, new Set([...primaries.values()].map(keyOf)));
    const quality = classifyPaletteQualityV1({ role: input.role, coverage: metrics.coverage, medianLuma: metrics.median, overexposureRatio: metrics.overexposure, meanDelta: metrics.blur, ...border, faceDetectorAvailable: input.faceDetectorAvailable });
    const { warnings: orderedWarnings, confidence } = quality;
    const provenance = { source: 'photo-analysis', sourcePhotoIds: [input.photoId], evidenceState: 'available', analyzerVersion: VERSION, confidence };
    const operations = fields.map((field) => ({ op: 'set-palette', field, value: palette(primaries.get(field)), provenance: { ...provenance, sourcePhotoIds: [...provenance.sourcePhotoIds] } }));
    return ok({ id: input.createId?.() ?? `proposal-${input.photoId}`, baseIdentityRevision: input.baseIdentityRevision, operations, evidencePhotoIds: [input.photoId], analyzerVersion: VERSION, confidence, warnings: orderedWarnings });
  } catch (error) { return err({ kind: error.kind ?? 'analysis-failed', message: error.message }); }
}

export const createPaletteAnalyzerV1 = () => Object.freeze({ analyze: analyzePaletteV1 });
