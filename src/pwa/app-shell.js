export const PUBLIC_BASE = '/my-avatars/';
export const SHELL_VERSION = 'v5';
export const CACHE_PREFIX = 'my-avatars-shell-';
export const CACHE_NAME = `${CACHE_PREFIX}${SHELL_VERSION}`;

export const PUBLIC_PATHS = Object.freeze([
  '/my-avatars/',
  '/my-avatars/app.js',
  '/my-avatars/icons/my-avatars.svg',
  '/my-avatars/manifest.webmanifest',
  '/my-avatars/presentation-config.schema.v1.json',
  '/my-avatars/presentation-config.v1.json',
  '/my-avatars/src/avatar-kernel/kernel.js',
  '/my-avatars/src/avatar-kernel/projection.js',
  '/my-avatars/src/compilers/minecraft/compiler.js',
  '/my-avatars/src/compilers/minecraft/layout-v1.js',
  '/my-avatars/src/compilers/minecraft/painter.js',
  '/my-avatars/src/compilers/minecraft/png.js',
  '/my-avatars/src/compilers/roblox-classic/compiler.js',
  '/my-avatars/src/compilers/roblox-classic/package.js',
  '/my-avatars/src/compilers/roblox-classic/painter.js',
  '/my-avatars/src/compilers/roblox-classic/template-v1.js',
  '/my-avatars/src/domain/canonical-json.js',
  '/my-avatars/src/domain/contracts.js',
  '/my-avatars/src/domain/defaults.js',
  '/my-avatars/src/domain/digest.js',
  '/my-avatars/src/domain/result.js',
  '/my-avatars/src/experimental/capture-route.js',
  '/my-avatars/src/identity-analyzer/palette-analyzer-v1.js',
  '/my-avatars/src/identity-library/backup.js',
  '/my-avatars/src/identity-library/database.js',
  '/my-avatars/src/identity-library/photo-normalizer.js',
  '/my-avatars/src/identity-library/repository.js',
  '/my-avatars/src/integration/bootstrap.js',
  '/my-avatars/src/integration/app-controller.js',
  '/my-avatars/src/integration/backup-controller.js',
  '/my-avatars/src/integration/browser-photo-adapter.js',
  '/my-avatars/src/integration/capture-controller.js',
  '/my-avatars/src/integration/durable-library.js',
  '/my-avatars/src/integration/export-controller.js',
  '/my-avatars/src/integration/library-controller.js',
  '/my-avatars/src/presentation/config.js',
  '/my-avatars/src/presentation/shell.js',
  '/my-avatars/src/pwa/app-shell.js',
  '/my-avatars/src/pwa/optional-viewer.js',
  '/my-avatars/src/pwa/register-service-worker.js',
  '/my-avatars/src/routing/resolve-route.js',
  '/my-avatars/src/studio-session/memory-library.js',
  '/my-avatars/src/studio-session/studio-session.js',
  '/my-avatars/src/studio-session/view-model.js',
  '/my-avatars/styles.css',
  '/my-avatars/sw.js',
  '/my-avatars/viewer.js',
]);

const header = (headers, name) => {
  if (typeof headers?.get === 'function') return headers.get(name);
  const key = Object.keys(headers ?? {}).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
};

export function shouldHandleRequest(request, scopeOrigin = null) {
  if (!request || request.method !== 'GET' || header(request.headers, 'Authorization')) return false;
  let url;
  try { url = new URL(request.url); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol) || (scopeOrigin && url.origin !== scopeOrigin) || url.search) return false;
  if (/\/(?:downloads?|generated)(?:\/|$)/.test(url.pathname) || url.pathname.includes('/workshop/')) return false;
  return PUBLIC_PATHS.includes(url.pathname);
}

const assetUrl = (path, origin) => new URL(path, origin).href;

export async function installCompleteShell({ cacheStorage, fetchAsset, origin }) {
  const stagingName = `${CACHE_NAME}-installing`;
  const existingNames = await cacheStorage.keys();
  if (existingNames.includes(CACHE_NAME)) {
    const existing = await cacheStorage.open(CACHE_NAME);
    let complete = true;
    for (const path of PUBLIC_PATHS) if (!await existing.match(assetUrl(path, origin))) { complete = false; break; }
    if (complete) return CACHE_NAME;
  }
  await cacheStorage.delete(stagingName);
  await cacheStorage.delete(CACHE_NAME);
  try {
    const staging = await cacheStorage.open(stagingName);
    for (const path of PUBLIC_PATHS) {
      const url = assetUrl(path, origin);
      const response = await fetchAsset(url);
      if (!response?.ok) throw new TypeError(`App-shell fetch failed: ${path}`);
      await staging.put(url, response.clone());
    }
    const complete = await cacheStorage.open(CACHE_NAME);
    for (const path of PUBLIC_PATHS) {
      const url = assetUrl(path, origin), response = await staging.match(url);
      if (!response) throw new TypeError(`Staged app-shell asset missing: ${path}`);
      await complete.put(url, response.clone());
    }
    return CACHE_NAME;
  } catch (error) {
    await cacheStorage.delete(CACHE_NAME);
    throw error;
  } finally {
    await cacheStorage.delete(stagingName);
  }
}

export async function deleteObsoleteShellCaches(cacheStorage) {
  const names = await cacheStorage.keys();
  await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => cacheStorage.delete(name)));
}

export function activateWaitingWorker(registration, state) {
  if (!state?.userChoseReload || state.hasUnsavedDraft || state.migrationInProgress || !registration?.waiting) return false;
  registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  return true;
}
