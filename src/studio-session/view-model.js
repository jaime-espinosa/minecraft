import { PUBLIC_ROUTES } from '../routing/resolve-route.js';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const clone = (value) => structuredClone(value);

const acceptedPalette = (frame, field) => {
  if (field === 'complexion') return frame.identity.complexionPalette;
  if (field === 'hair') return frame.identity.hair.palette;
  return frame.identity.outfit[field];
};

const projectProposal = (proposal, frame, photos) => {
  if (!proposal) return null;
  const rolesById = new Map(photos.map(({ id, role }) => [id, role]));
  return {
    id: proposal.id,
    confidence: proposal.confidence,
    warnings: clone(proposal.warnings),
    evidenceRoles: [...new Set(proposal.evidencePhotoIds.map((id) => rolesById.get(id)).filter(Boolean))],
    preselectedFields: proposal.confidence === 'high' ? proposal.operations.map(({ field }) => field) : [],
    operations: proposal.operations.map(({ field, value }) => ({
      field,
      accepted: clone(acceptedPalette(frame, field)),
      proposed: clone(value),
    })),
  };
};

export function createStudioViewModel({
  frame,
  recipes,
  route = '#/studio',
  proposal = null,
  platforms = {},
  photos = [],
  busy = false,
  fault = null,
  announcement = 'Your avatar is ready.',
}) {
  const model = {
    route,
    navigation: PUBLIC_ROUTES.map((target) => ({ target, current: target === route })),
    identityRevision: frame.identity.revision,
    activeRecipe: clone(frame.recipe),
    recipes: clone(recipes),
    editor: {
      complexionPalette: clone(frame.identity.complexionPalette),
      hair: clone(frame.identity.hair),
      face: clone(frame.identity.face),
      outfit: clone(frame.identity.outfit),
      accessories: clone(frame.identity.accessories),
      style: clone(frame.recipe.style),
      platformProfiles: clone(frame.recipe.platformProfiles),
    },
    proposal: projectProposal(proposal, frame, photos),
    previews: {
      minecraft: { url: platforms.minecraft?.url ?? null, preflight: clone(platforms.minecraft?.preflight ?? null), status: platforms.minecraft?.status ?? 'idle' },
      robloxClassic: {
        url: platforms.robloxClassic?.url ?? null,
        shirtUrl: platforms.robloxClassic?.shirtUrl ?? null,
        pantsUrl: platforms.robloxClassic?.pantsUrl ?? null,
        preflight: clone(platforms.robloxClassic?.preflight ?? null),
        status: platforms.robloxClassic?.status ?? 'idle',
      },
    },
    exports: {
      minecraft: platforms.minecraft?.filename ? { available: true, filename: platforms.minecraft.filename } : { available: false, filename: 'my-avatar-minecraft.png' },
      robloxClassic: platforms.robloxClassic?.filename ? { available: true, filename: platforms.robloxClassic.filename } : { available: false, filename: null },
    },
    library: {
      photos: photos.map(({ id, role, width, height, createdAt }) => ({ id, role, width, height, createdAt })),
      canDeletePhotos: photos.length > 0,
      canResetPerson: true,
    },
    busy,
    fault: fault ? clone(fault) : null,
    announcement,
  };
  return deepFreeze(model);
}
