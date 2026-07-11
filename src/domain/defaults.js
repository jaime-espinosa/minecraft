const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const palette = (primary, shadow, highlight) => ({ primary, shadow, highlight });
const provenance = () => ({ source: 'default', sourcePhotoIds: [], evidenceState: 'not-applicable' });

const identitySeed = () => ({
  schemaVersion: 1,
  revision: 1,
  complexionPalette: palette('#c98e68', '#8f6048', '#e8b38d'),
  hair: {
    style: 'curl',
    volume: 2,
    palette: palette('#422a1f', '#2d1c16', '#654333'),
  },
  face: { expression: 'smile', eyeColor: '#24201e' },
  outfit: {
    top: palette('#376c80', '#274d5c', '#5792a8'),
    bottom: palette('#314659', '#22313f', '#526b80'),
    footwear: palette('#241e1c', '#171312', '#493d39'),
    outerwear: false,
  },
  accessories: [],
  provenance: {
    complexion: provenance(),
    hair: provenance(),
    top: provenance(),
    bottom: provenance(),
    footwear: provenance(),
  },
});

const recipeSeed = () => ({
  schemaVersion: 1,
  id: 'avatar-1',
  revision: 1,
  localLabel: 'Avatar 1',
  identityRevision: 1,
  style: { shading: 'block', outline: false },
  platformProfiles: {
    minecraft: { geometry: 'classic', outerLayers: true },
    robloxClassic: { blockAvatarNoticeAccepted: false },
  },
});

export const createDefaultIdentity = () => deepFreeze(identitySeed());
export const createDefaultRecipe = () => deepFreeze(recipeSeed());

export const DEFAULT_IDENTITY = createDefaultIdentity();
export const DEFAULT_RECIPE = createDefaultRecipe();
