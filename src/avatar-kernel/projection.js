import { validateAppearanceSnapshotV1, validateAvatarFrame } from '../domain/contracts.js';
import { digestCanonicalJson } from '../domain/digest.js';

export const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key]));
    Object.freeze(value);
  }
  return value;
};

const clone = (value) => structuredClone(value);

export function projectSemanticAppearance(frame) {
  validateAvatarFrame(frame);
  return {
    complexionPalette: clone(frame.identity.complexionPalette),
    hair: clone(frame.identity.hair),
    face: clone(frame.identity.face),
    outfit: clone(frame.identity.outfit),
    accessories: clone(frame.identity.accessories),
    style: clone(frame.recipe.style),
  };
}

export async function createAppearanceSnapshot(frame) {
  validateAvatarFrame(frame);
  const semanticAppearance = projectSemanticAppearance(frame);
  const sourceRecord = {
    schemaVersion: 1,
    identityRevision: frame.identity.revision,
    recipeId: frame.recipe.id,
    recipeRevision: frame.recipe.revision,
    semanticAppearance,
  };
  const snapshot = {
    schemaVersion: 1,
    identityRevision: frame.identity.revision,
    recipeId: frame.recipe.id,
    recipeRevision: frame.recipe.revision,
    semanticAppearance,
    sourceDigest: await digestCanonicalJson(sourceRecord),
  };
  validateAppearanceSnapshotV1(snapshot);
  return deepFreeze(snapshot);
}
