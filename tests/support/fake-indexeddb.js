import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

export const createFakeIndexedDB = () => new IDBFactory();
export const createNormalizedPhoto = (overrides = {}) => {
  const mimeType = overrides.metadata?.mimeType ?? 'image/jpeg';
  return {
    metadata: {
      id: 'photo-1', role: 'face-front', blobKey: 'blob-1', pixelDigest: 'a'.repeat(64),
      mimeType, width: 100, height: 100, createdAt: '2026-07-11T00:00:00.000Z',
      normalizationVersion: 'normalize-v1', focusRegion: { centerX: 0.5, centerY: 0.5, size: 1 },
      ...overrides.metadata,
    },
    blob: overrides.blob ?? new Blob(['normalized'], { type: mimeType }),
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !['metadata', 'blob'].includes(key))),
  };
};
export const createDraft = (overrides = {}) => ({
  id: 'draft-1', recipeId: 'avatar-1', sourcePhotoIds: ['photo-1'], baseRecipeRevision: 1,
  operations: [{
    op: 'set-palette', field: 'hair',
    value: { primary: '#422a1f', shadow: '#2d1c16', highlight: '#654333' },
    provenance: { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'available' },
  }],
  createdAt: '2026-07-11T00:00:00.000Z', ...overrides,
});
export const createArtifactRecord = (overrides = {}) => ({
  id: 'artifact-1', recipeId: 'avatar-1', sourcePhotoIds: ['photo-1'], compiler: 'minecraft-v1',
  sourceDigest: 'c'.repeat(64), createdAt: '2026-07-11T00:00:00.000Z', ...overrides,
});
export { IDBKeyRange };
