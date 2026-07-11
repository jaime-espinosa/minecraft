import {
  ContractValidationError,
  validateAppearanceSnapshotV1,
  validateArtifactBundleV1,
  validateMinecraftProfileV1,
} from '../../domain/contracts.js';
import { digestBytes } from '../../domain/digest.js';
import { err, ok } from '../../domain/result.js';
import { BASE_PARTS, FACE_NAMES, getMinecraftLayout } from './layout-v1.js';
import { paintMinecraftTexture } from './painter.js';
import { decodePngRgba, encodePngRgba } from './png.js';

const check = (id, passed, message) => ({ id, passed, message });

const countAlpha = (rgba, region) => {
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) if (rgba[(y * 64 + x) * 4 + 3] !== 0) count += 1;
  }
  return count;
};

const compileFault = (kind, error) => err({ kind, message: error.message });

const readCompileInput = (input) => {
  if (input === null || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new ContractValidationError('$', 'compiler input must be a plain object');
  }
  const required = ['snapshot', 'profile'];
  const values = {};
  for (const key of Reflect.ownKeys(input)) {
    const path = `$.${typeof key === 'symbol' ? key.toString() : key}`;
    if (typeof key !== 'string' || !required.includes(key)) throw new ContractValidationError(path, 'unknown key');
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor.enumerable) throw new ContractValidationError(path, 'non-enumerable keys are not supported');
    if (!Object.hasOwn(descriptor, 'value')) throw new ContractValidationError(path, 'accessor properties are not supported');
    values[key] = descriptor.value;
  }
  for (const key of required) if (!Object.hasOwn(values, key)) throw new ContractValidationError(`$.${key}`, 'is required');
  return values;
};

export function createMinecraftCompiler() {
  return Object.freeze({
    async compile(input) {
      let snapshot;
      let profile;
      try {
        ({ snapshot, profile } = readCompileInput(input));
      } catch (error) {
        return compileFault('invalid-snapshot', error);
      }
      try {
        validateAppearanceSnapshotV1(snapshot);
      } catch (error) {
        return compileFault('invalid-snapshot', error);
      }
      try {
        validateMinecraftProfileV1(profile);
      } catch (error) {
        return compileFault('invalid-profile', error);
      }
      try {
        const rgba = paintMinecraftTexture(snapshot, profile);
        const pixelDigest = await digestBytes(rgba);
        const artifact = {
          filename: 'my-avatar-minecraft.png',
          mediaType: 'image/png',
          width: 64,
          height: 64,
          pixelDigest,
          bytes: encodePngRgba(64, 64, rgba),
        };
        const bundle = {
          compiler: 'minecraft-v1',
          sourceDigest: snapshot.sourceDigest,
          artifacts: [artifact],
        };
        validateArtifactBundleV1(bundle);
        return ok(bundle);
      } catch (error) {
        return compileFault(error instanceof ContractValidationError ? 'invalid-snapshot' : 'render-failed', error);
      }
    },

    async preflight(bundle) {
      const checks = [];
      try {
        validateArtifactBundleV1(bundle);
        checks.push(check('bundle-contract', true, 'Artifact bundle contract is valid.'));
        const compilerMatches = bundle.compiler === 'minecraft-v1';
        checks.push(check('compiler', compilerMatches, 'Bundle compiler is minecraft-v1.'));
        if (!compilerMatches) return Object.freeze({ passed: false, checks: Object.freeze(checks.map(Object.freeze)) });
        const artifactCountMatches = bundle.artifacts.length === 1;
        checks.push(check('artifact-count', artifactCountMatches, 'Bundle contains exactly one Minecraft PNG artifact.'));
        if (!artifactCountMatches) return Object.freeze({ passed: false, checks: Object.freeze(checks.map(Object.freeze)) });
        const artifact = bundle.artifacts.find(({ filename }) => filename === 'my-avatar-minecraft.png');
        if (!artifact) throw new TypeError('Minecraft PNG artifact is missing');
        const metadataMatches = artifact.mediaType === 'image/png'
          && artifact.width === 64
          && artifact.height === 64;
        checks.push(check('artifact-metadata', metadataMatches, 'Artifact declares image/png at 64 x 64.'));
        const decoded = decodePngRgba(artifact.bytes);
        checks.push(check('dimensions', decoded.width === 64 && decoded.height === 64, 'Texture dimensions are 64 x 64.'));
        const digest = await digestBytes(decoded.rgba);
        checks.push(check('pixel-digest', digest === artifact.pixelDigest, 'Decoded pixels match the declared digest.'));
        const complete = ['classic', 'slim'].some((geometry) => {
          const layout = getMinecraftLayout({ geometry });
          return BASE_PARTS.every((part) => FACE_NAMES.every((face) => {
            const region = layout.parts[part].faces[face];
            return countAlpha(decoded.rgba, region) === region.width * region.height;
          }));
        });
        checks.push(check('required-regions', complete, 'Required base regions are complete.'));
        const hat = getMinecraftLayout({ geometry: 'classic' }).parts.hat;
        const hairComplete = FACE_NAMES.every((face) => countAlpha(decoded.rgba, hat.faces[face]) > 0);
        checks.push(check('hair-layer', hairComplete, 'Hat-layer hair regions are nonempty.'));
        const outerComplete = ['classic', 'slim'].some((geometry) => {
          const layout = getMinecraftLayout({ geometry });
          const parts = ['jacket', 'rightSleeve', 'leftSleeve', 'rightPants', 'leftPants'];
          const counts = parts.flatMap((part) => FACE_NAMES.map((face) => {
            const region = layout.parts[part].faces[face];
            return { count: countAlpha(decoded.rgba, region), area: region.width * region.height };
          }));
          const enabled = counts.some(({ count }) => count > 0);
          return enabled ? counts.every(({ count, area }) => count === area) : true;
        });
        checks.push(check('outer-regions', outerComplete, 'Enabled outer clothing regions are complete and aligned.'));
      } catch (error) {
        checks.push(check('decode', false, error.message));
      }
      return Object.freeze({ passed: checks.every(({ passed }) => passed), checks: Object.freeze(checks.map(Object.freeze)) });
    },
  });
}
