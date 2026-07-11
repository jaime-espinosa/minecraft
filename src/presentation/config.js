const freeze = (value) => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

export const DEFAULT_PRESENTATION_CONFIG = freeze({
  schemaVersion: 1,
  layoutVariant: 'stage-left',
  tokens: { surface: '#11152f', panel: '#24204d', action: '#74f0c6', accent: '#63b7ff' },
  labels: { brand: 'My Avatars', build: 'Build', library: 'Library', export: 'Export' },
  order: ['build', 'library', 'export'],
  features: { privacy: true, deletion: true, validation: true, exports: true, accessibility: true },
});

const exact = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
  && Reflect.ownKeys(object).every((key) => typeof key === 'string' && keys.includes(key))
  && keys.every((key) => Object.hasOwn(object, key));

const valid = (candidate) => exact(candidate, ['schemaVersion', 'layoutVariant', 'tokens', 'labels', 'order', 'features'])
  && candidate.schemaVersion === 1
  && ['stage-left', 'stage-right', 'stage-top'].includes(candidate.layoutVariant)
  && exact(candidate.tokens, ['surface', 'panel', 'action', 'accent'])
  && Object.values(candidate.tokens).every((color) => /^#[0-9a-f]{6}$/.test(color))
  && exact(candidate.labels, ['brand', 'build', 'library', 'export'])
  && Object.values(candidate.labels).every((label) => typeof label === 'string' && label.length > 0)
  && Array.isArray(candidate.order) && candidate.order.join(',') === 'build,library,export'
  && exact(candidate.features, ['privacy', 'deletion', 'validation', 'exports', 'accessibility'])
  && Object.values(candidate.features).every((enabled) => enabled === true);

export function resolvePresentationConfig(candidate) {
  if (!valid(candidate)) return DEFAULT_PRESENTATION_CONFIG;
  return freeze(structuredClone(candidate));
}
