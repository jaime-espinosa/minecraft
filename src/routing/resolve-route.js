export const PUBLIC_ROUTES = Object.freeze([
  '#/studio',
  '#/library',
  '#/experimental/capture',
  '#/export/minecraft',
  '#/export/roblox-classic',
]);

const compatibility = Object.freeze({
  '#/solid': ['#/studio', 'Opened the dependable studio.'],
  '#/solid/library': ['#/library', 'Opened your local library.'],
  '#/experimental': ['#/experimental/capture', 'Opened progressive capture.'],
});

const freeze = (value) => Object.freeze(value);

export function resolveRoute(hash) {
  if (PUBLIC_ROUTES.includes(hash)) return freeze({ route: hash, redirectedFrom: null, notice: null });
  if (Object.hasOwn(compatibility, hash)) {
    const [route, notice] = compatibility[hash];
    return freeze({ route, redirectedFrom: hash, notice });
  }
  return freeze({
    route: '#/studio',
    redirectedFrom: hash || null,
    notice: 'That view is unavailable. Opened the dependable studio without changing your avatar.',
  });
}
