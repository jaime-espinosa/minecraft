import { err, ok } from './result.js';

const COLOR = /^#[0-9a-f]{6}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const PHOTO_ROLES = ['face-front', 'face-smile', 'face-left', 'face-right', 'hair-detail', 'outfit-front', 'outfit-detail', 'other'];
const CONFIDENCE = ['high', 'review', 'low'];
const ANALYZER_WARNINGS = ['blur', 'low-light', 'overexposure', 'low-coverage', 'background-risk', 'face-detector-unavailable'];

export class ContractValidationError extends TypeError {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = 'ContractValidationError';
    this.path = path;
  }
}

const fail = (path, message) => { throw new ContractValidationError(path, message); };
const propertyPath = (path, key) => `${path}.${typeof key === 'symbol' ? key.toString() : key}`;
const object = (value, path) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(path, 'must be a plain object');
  }
  return value;
};
const exactKeys = (value, required, optional, path) => {
  object(value, path);
  const allowed = new Set([...required, ...optional]);
  for (const key of Reflect.ownKeys(value)) {
    const keyPath = propertyPath(path, key);
    if (typeof key !== 'string' || !allowed.has(key)) fail(keyPath, 'unknown key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable) fail(keyPath, 'non-enumerable own keys are not supported');
    if (!Object.hasOwn(descriptor, 'value')) fail(keyPath, 'accessor properties are not supported');
  }
  for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'is required');
  return value;
};
const string = (value, path, { nonempty = true } = {}) => {
  if (typeof value !== 'string' || (nonempty && value.length === 0)) fail(path, 'must be a nonempty string');
  return value;
};
const boolean = (value, path) => {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean');
  return value;
};
const finite = (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number');
  return value;
};
const integer = (value, path, minimum = 0) => {
  finite(value, path);
  if (!Number.isInteger(value) || value < minimum) fail(path, `must be an integer greater than or equal to ${minimum}`);
  return value;
};
const enumValue = (value, allowed, path) => {
  if (!allowed.includes(value)) fail(path, `unsupported value ${JSON.stringify(value)}`);
  return value;
};
const array = (value, path) => {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  const allowed = new Set(['length']);
  for (let index = 0; index < value.length; index += 1) allowed.add(String(index));
  for (const key of Reflect.ownKeys(value)) {
    const keyPath = typeof key === 'string' && key !== 'length' ? `${path}[${key}]` : propertyPath(path, key);
    if (typeof key !== 'string' || !allowed.has(key)) fail(keyPath, 'unknown key');
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable) fail(keyPath, 'non-enumerable array entries are not supported');
    if (!Object.hasOwn(descriptor, 'value')) fail(keyPath, 'accessor array entries are not supported');
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'sparse arrays are not supported');
  }
  return value;
};
const color = (value, path) => {
  if (typeof value !== 'string' || !COLOR.test(value)) fail(path, 'must be a lowercase six-digit sRGB color');
  return value;
};
const digest = (value, path) => {
  if (typeof value !== 'string' || !HEX_DIGEST.test(value)) fail(path, 'must be a lowercase SHA-256 digest');
  return value;
};
const typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  Symbol.toStringTag,
).get;
const isExactUint8Array = (value) => ArrayBuffer.isView(value)
  && typedArrayTag.call(value) === 'Uint8Array';

export function validateSemanticPalette(value, path = '$') {
  exactKeys(value, ['primary', 'shadow', 'highlight'], [], path);
  color(value.primary, `${path}.primary`);
  color(value.shadow, `${path}.shadow`);
  color(value.highlight, `${path}.highlight`);
  return value;
}

export function validateSemanticHair(value, path = '$') {
  exactKeys(value, ['style', 'volume', 'palette'], [], path);
  enumValue(value.style, ['crop', 'curl', 'sweep', 'long'], `${path}.style`);
  enumValue(value.volume, [1, 2, 3], `${path}.volume`);
  validateSemanticPalette(value.palette, `${path}.palette`);
  return value;
}

export function validateSemanticFace(value, path = '$') {
  exactKeys(value, ['expression', 'eyeColor'], [], path);
  enumValue(value.expression, ['neutral', 'smile', 'grin'], `${path}.expression`);
  color(value.eyeColor, `${path}.eyeColor`);
  return value;
}

export function validateSemanticOutfit(value, path = '$') {
  exactKeys(value, ['top', 'bottom', 'footwear', 'outerwear'], [], path);
  validateSemanticPalette(value.top, `${path}.top`);
  validateSemanticPalette(value.bottom, `${path}.bottom`);
  validateSemanticPalette(value.footwear, `${path}.footwear`);
  boolean(value.outerwear, `${path}.outerwear`);
  return value;
}

export function validateSemanticAccessory(value, path = '$') {
  exactKeys(value, ['kind', 'color'], [], path);
  enumValue(value.kind, ['glasses', 'beard'], `${path}.kind`);
  color(value.color, `${path}.color`);
  return value;
}

export function validateAvatarStyleV1(value, path = '$') {
  exactKeys(value, ['shading', 'outline'], [], path);
  enumValue(value.shading, ['block', 'soft'], `${path}.shading`);
  boolean(value.outline, `${path}.outline`);
  return value;
}

export function validateMinecraftProfileV1(value, path = '$') {
  exactKeys(value, ['geometry', 'outerLayers'], [], path);
  enumValue(value.geometry, ['classic', 'slim'], `${path}.geometry`);
  boolean(value.outerLayers, `${path}.outerLayers`);
  return value;
}

export function validateRobloxClassicProfileV1(value, path = '$') {
  exactKeys(value, ['blockAvatarNoticeAccepted'], [], path);
  boolean(value.blockAvatarNoticeAccepted, `${path}.blockAvatarNoticeAccepted`);
  return value;
}

export function validateFieldProvenanceV1(value, path = '$') {
  exactKeys(value, ['source', 'sourcePhotoIds', 'evidenceState'], ['analyzerVersion', 'confidence'], path);
  enumValue(value.source, ['default', 'manual', 'photo-analysis'], `${path}.source`);
  array(value.sourcePhotoIds, `${path}.sourcePhotoIds`).forEach((id, index) => string(id, `${path}.sourcePhotoIds[${index}]`));
  enumValue(value.evidenceState, ['available', 'deleted', 'not-applicable'], `${path}.evidenceState`);
  if (Object.hasOwn(value, 'analyzerVersion')) string(value.analyzerVersion, `${path}.analyzerVersion`);
  if (Object.hasOwn(value, 'confidence')) enumValue(value.confidence, CONFIDENCE, `${path}.confidence`);

  const local = (value.source === 'default' || value.source === 'manual')
    && value.sourcePhotoIds.length === 0
    && value.evidenceState === 'not-applicable'
    && !Object.hasOwn(value, 'analyzerVersion')
    && !Object.hasOwn(value, 'confidence');
  const retained = value.source === 'photo-analysis'
    && value.sourcePhotoIds.length > 0
    && value.evidenceState === 'available';
  const deleted = value.source === 'photo-analysis'
    && value.sourcePhotoIds.length === 0
    && value.evidenceState === 'deleted';
  if (!local && !retained && !deleted) fail(path, 'invalid provenance combination');
  return value;
}

export function validateSourcePhotoV1(value, path = '$') {
  exactKeys(value, ['id', 'role', 'blobKey', 'pixelDigest', 'mimeType', 'width', 'height', 'createdAt', 'normalizationVersion', 'focusRegion'], [], path);
  string(value.id, `${path}.id`);
  enumValue(value.role, PHOTO_ROLES, `${path}.role`);
  string(value.blobKey, `${path}.blobKey`);
  digest(value.pixelDigest, `${path}.pixelDigest`);
  enumValue(value.mimeType, ['image/jpeg', 'image/png'], `${path}.mimeType`);
  integer(value.width, `${path}.width`, 1);
  integer(value.height, `${path}.height`, 1);
  string(value.createdAt, `${path}.createdAt`);
  string(value.normalizationVersion, `${path}.normalizationVersion`);
  exactKeys(value.focusRegion, ['centerX', 'centerY', 'size'], [], `${path}.focusRegion`);
  finite(value.focusRegion.centerX, `${path}.focusRegion.centerX`);
  finite(value.focusRegion.centerY, `${path}.focusRegion.centerY`);
  finite(value.focusRegion.size, `${path}.focusRegion.size`);
  if (value.focusRegion.centerX < 0 || value.focusRegion.centerX > 1) fail(`${path}.focusRegion.centerX`, 'must be between 0 and 1');
  if (value.focusRegion.centerY < 0 || value.focusRegion.centerY > 1) fail(`${path}.focusRegion.centerY`, 'must be between 0 and 1');
  if (value.focusRegion.size < 0 || value.focusRegion.size > 1) fail(`${path}.focusRegion.size`, 'must be between 0 and 1');
  return value;
}

const validateProvenanceRecord = (value, path) => {
  object(value, path);
  for (const key of Reflect.ownKeys(value)) {
    const keyPath = propertyPath(path, key);
    if (typeof key !== 'string') fail(keyPath, 'unknown key');
    if (key.length === 0) fail(path, 'provenance keys must be nonempty');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable) fail(keyPath, 'non-enumerable own keys are not supported');
    if (!Object.hasOwn(descriptor, 'value')) fail(keyPath, 'accessor properties are not supported');
    validateFieldProvenanceV1(descriptor.value, keyPath);
  }
  return value;
};

export function validateIdentityProfileV1(value, path = '$') {
  exactKeys(value, ['schemaVersion', 'revision', 'complexionPalette', 'hair', 'face', 'outfit', 'accessories', 'provenance'], [], path);
  enumValue(value.schemaVersion, [1], `${path}.schemaVersion`);
  integer(value.revision, `${path}.revision`, 1);
  validateSemanticPalette(value.complexionPalette, `${path}.complexionPalette`);
  validateSemanticHair(value.hair, `${path}.hair`);
  validateSemanticFace(value.face, `${path}.face`);
  validateSemanticOutfit(value.outfit, `${path}.outfit`);
  array(value.accessories, `${path}.accessories`).forEach((item, index) => validateSemanticAccessory(item, `${path}.accessories[${index}]`));
  validateProvenanceRecord(value.provenance, `${path}.provenance`);
  return value;
}

export function validateAvatarRecipeV1(value, path = '$') {
  exactKeys(value, ['schemaVersion', 'id', 'revision', 'localLabel', 'identityRevision', 'style', 'platformProfiles'], [], path);
  enumValue(value.schemaVersion, [1], `${path}.schemaVersion`);
  string(value.id, `${path}.id`);
  integer(value.revision, `${path}.revision`, 1);
  string(value.localLabel, `${path}.localLabel`);
  integer(value.identityRevision, `${path}.identityRevision`, 1);
  validateAvatarStyleV1(value.style, `${path}.style`);
  exactKeys(value.platformProfiles, ['minecraft', 'robloxClassic'], [], `${path}.platformProfiles`);
  validateMinecraftProfileV1(value.platformProfiles.minecraft, `${path}.platformProfiles.minecraft`);
  validateRobloxClassicProfileV1(value.platformProfiles.robloxClassic, `${path}.platformProfiles.robloxClassic`);
  return value;
}

export function validateSemanticAppearanceV1(value, path = '$') {
  exactKeys(value, ['complexionPalette', 'hair', 'face', 'outfit', 'accessories', 'style'], [], path);
  validateSemanticPalette(value.complexionPalette, `${path}.complexionPalette`);
  validateSemanticHair(value.hair, `${path}.hair`);
  validateSemanticFace(value.face, `${path}.face`);
  validateSemanticOutfit(value.outfit, `${path}.outfit`);
  array(value.accessories, `${path}.accessories`).forEach((item, index) => validateSemanticAccessory(item, `${path}.accessories[${index}]`));
  validateAvatarStyleV1(value.style, `${path}.style`);
  return value;
}

export function validateAppearanceSnapshotV1(value, path = '$') {
  exactKeys(value, ['schemaVersion', 'identityRevision', 'recipeId', 'recipeRevision', 'semanticAppearance', 'sourceDigest'], [], path);
  enumValue(value.schemaVersion, [1], `${path}.schemaVersion`);
  integer(value.identityRevision, `${path}.identityRevision`, 1);
  string(value.recipeId, `${path}.recipeId`);
  integer(value.recipeRevision, `${path}.recipeRevision`, 1);
  validateSemanticAppearanceV1(value.semanticAppearance, `${path}.semanticAppearance`);
  digest(value.sourceDigest, `${path}.sourceDigest`);
  return value;
}

export function validateIdentityOperation(value, path = '$') {
  exactKeys(value, ['op', 'field', 'value', 'provenance'], [], path);
  enumValue(value.op, ['set-palette'], `${path}.op`);
  enumValue(value.field, ['complexion', 'hair', 'top', 'bottom', 'footwear'], `${path}.field`);
  validateSemanticPalette(value.value, `${path}.value`);
  validateFieldProvenanceV1(value.provenance, `${path}.provenance`);
  return value;
}

export function validateAvatarOperation(value, path = '$') {
  object(value, path);
  switch (value.op) {
    case 'set-palette':
      return validateIdentityOperation(value, path);
    case 'set-hair':
      exactKeys(value, ['op', 'value'], [], path);
      exactKeys(value.value, ['style', 'volume'], [], `${path}.value`);
      enumValue(value.value.style, ['crop', 'curl', 'sweep', 'long'], `${path}.value.style`);
      enumValue(value.value.volume, [1, 2, 3], `${path}.value.volume`);
      return value;
    case 'set-expression':
      exactKeys(value, ['op', 'value'], [], path);
      enumValue(value.value, ['neutral', 'smile', 'grin'], `${path}.value`);
      return value;
    case 'set-accessories':
      exactKeys(value, ['op', 'value'], [], path);
      array(value.value, `${path}.value`).forEach((item, index) => validateSemanticAccessory(item, `${path}.value[${index}]`));
      return value;
    case 'set-style':
      exactKeys(value, ['op', 'value'], [], path);
      validateAvatarStyleV1(value.value, `${path}.value`);
      return value;
    default:
      fail(`${path}.op`, `unsupported value ${JSON.stringify(value.op)}`);
  }
}

export function validateProposedIdentityChangeV1(value, path = '$') {
  exactKeys(value, ['id', 'baseIdentityRevision', 'operations', 'evidencePhotoIds', 'analyzerVersion', 'confidence', 'warnings'], [], path);
  string(value.id, `${path}.id`);
  integer(value.baseIdentityRevision, `${path}.baseIdentityRevision`, 1);
  array(value.operations, `${path}.operations`).forEach((operation, index) => validateIdentityOperation(operation, `${path}.operations[${index}]`));
  array(value.evidencePhotoIds, `${path}.evidencePhotoIds`).forEach((id, index) => string(id, `${path}.evidencePhotoIds[${index}]`));
  string(value.analyzerVersion, `${path}.analyzerVersion`);
  enumValue(value.confidence, CONFIDENCE, `${path}.confidence`);
  array(value.warnings, `${path}.warnings`).forEach((warning, index) => enumValue(warning, ANALYZER_WARNINGS, `${path}.warnings[${index}]`));
  return value;
}

export function validateAvatarFrame(value, path = '$') {
  exactKeys(value, ['identity', 'recipe'], [], path);
  validateIdentityProfileV1(value.identity, `${path}.identity`);
  validateAvatarRecipeV1(value.recipe, `${path}.recipe`);
  if (value.recipe.identityRevision !== value.identity.revision) {
    fail(`${path}.recipe.identityRevision`, 'must match identity revision');
  }
  return value;
}

export function validateLocalPreflightCheckV1(value, path = '$') {
  exactKeys(value, ['id', 'passed', 'message'], [], path);
  string(value.id, `${path}.id`);
  boolean(value.passed, `${path}.passed`);
  string(value.message, `${path}.message`, { nonempty: false });
  return value;
}

export function validateLocalPreflightReportV1(value, path = '$') {
  exactKeys(value, ['passed', 'checks'], [], path);
  boolean(value.passed, `${path}.passed`);
  array(value.checks, `${path}.checks`).forEach((check, index) => validateLocalPreflightCheckV1(check, `${path}.checks[${index}]`));
  return value;
}

export function validateArtifactV1(value, path = '$') {
  exactKeys(value, ['filename', 'mediaType', 'bytes'], ['width', 'height', 'pixelDigest'], path);
  string(value.filename, `${path}.filename`);
  string(value.mediaType, `${path}.mediaType`);
  if (Object.hasOwn(value, 'width')) integer(value.width, `${path}.width`, 1);
  if (Object.hasOwn(value, 'height')) integer(value.height, `${path}.height`, 1);
  if (Object.hasOwn(value, 'pixelDigest')) digest(value.pixelDigest, `${path}.pixelDigest`);
  if (!isExactUint8Array(value.bytes)) fail(`${path}.bytes`, 'must be a Uint8Array');
  return value;
}

export function validateArtifactBundleV1(value, path = '$') {
  exactKeys(value, ['compiler', 'sourceDigest', 'artifacts'], [], path);
  enumValue(value.compiler, ['minecraft-v1', 'roblox-classic-v1'], `${path}.compiler`);
  digest(value.sourceDigest, `${path}.sourceDigest`);
  array(value.artifacts, `${path}.artifacts`).forEach((artifact, index) => validateArtifactV1(artifact, `${path}.artifacts[${index}]`));
  return value;
}

const asResult = (kind, validator, value) => {
  try {
    return ok(validator(value));
  } catch (error) {
    if (!(error instanceof ContractValidationError)) throw error;
    return err({ kind, path: error.path, message: error.message });
  }
};

export const validateIdentity = (value) => asResult('invalid-seed', validateIdentityProfileV1, value);
export const validateRecipe = (value) => asResult('invalid-seed', validateAvatarRecipeV1, value);
export const validateProvenance = (value) => asResult('invalid-provenance', validateFieldProvenanceV1, value);
