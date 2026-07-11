import { createAvatarKernel } from './src/avatar-kernel/kernel.js';
import { createMinecraftCompiler } from './src/compilers/minecraft/compiler.js';
import { resolveRoute } from './src/routing/resolve-route.js';
import { resolvePresentationConfig } from './src/presentation/config.js';
import { renderStudioShell } from './src/presentation/shell.js';
import { createOptionalMinecraftViewerController } from './src/pwa/optional-viewer.js';
import { createStudioSession } from './src/studio-session/studio-session.js';

const loadConfig = async () => {
  try {
    const response = await fetch('./presentation-config.v1.json', { cache: 'no-store' });
    return resolvePresentationConfig(response.ok ? await response.json() : null);
  } catch {
    return resolvePresentationConfig(null);
  }
};

const config = await loadConfig();
const tokenVariables = { surface: '--surface', panel: '--panel', action: '--mint', accent: '--blue' };
for (const [name, value] of Object.entries(config.tokens)) document.documentElement.style.setProperty(tokenVariables[name], value);

const session = createStudioSession({
  kernel: createAvatarKernel(),
  minecraftCompiler: createMinecraftCompiler(),
  urls: {
    createObjectURL(bytes, mediaType) { return URL.createObjectURL(new Blob([bytes], { type: mediaType })); },
    revokeObjectURL(url) { URL.revokeObjectURL(url); },
  },
});
renderStudioShell(document, session, config);

const minecraftTextureImage = document.querySelector('#minecraft-texture-image');
const minecraftViewerContainer = document.querySelector('#minecraft-avatar-viewer');
const minecraftViewerNotice = document.querySelector('#minecraft-viewer-notice');
const viewerController = createOptionalMinecraftViewerController({
  load: (texture) => import('./viewer.js').then(({ createMinecraftAvatarViewer }) => createMinecraftAvatarViewer(minecraftViewerContainer, texture)),
  show() { minecraftViewerContainer.hidden = false; minecraftViewerNotice.hidden = true; },
  hide() { minecraftViewerContainer.hidden = true; },
  unavailable() {
    minecraftViewerNotice.hidden = false;
    minecraftViewerNotice.textContent = '3D preview is unavailable. Your exact 2D preview and download still work.';
  },
});
minecraftTextureImage.addEventListener('load', () => {
  const url = session.getViewModel().previews.minecraft.url;
  viewerController.loadTexture(minecraftTextureImage, url, document.querySelector('#slim').checked);
});

let pendingUpdate = null;
const updateNotice = document.querySelector('#pwa-update-notice');
const updateMessage = document.querySelector('#pwa-update-message');
const reloadUpdate = document.querySelector('#reload-update');
const renderUpdate = () => {
  if (!pendingUpdate) return;
  const safety = session.getUpdateSafety();
  updateNotice.hidden = false;
  reloadUpdate.disabled = safety.hasUnsavedDraft || safety.hasMigration;
  updateMessage.textContent = reloadUpdate.disabled
    ? 'An offline update is ready. Save this look before reloading.'
    : 'An offline update is ready.';
};
session.subscribe((model) => { viewerController.setTextureUrl(model.previews.minecraft.url); renderUpdate(); });
reloadUpdate.addEventListener('click', () => pendingUpdate?.activateWhenSafe());
addEventListener('load', () => {
  import('./src/pwa/register-service-worker.js')
    .then(({ registerMyAvatarsServiceWorker }) => registerMyAvatarsServiceWorker({ getUpdateSafety: () => session.getUpdateSafety(), onReloadDeferred: renderUpdate, onUpdate(update) { pendingUpdate = update; renderUpdate(); } }))
    .catch(() => {
      updateNotice.hidden = false;
      reloadUpdate.hidden = true;
      updateMessage.textContent = 'Offline installation is unavailable. Editing and downloads still work.';
    });
});

const handleRoute = async () => {
  const route = resolveRoute(location.hash);
  if (location.hash !== route.route) history.replaceState(null, '', route.route);
  await session.dispatch({ type: 'navigate', route: route.route });
  document.querySelector('#route-notice').textContent = route.notice ?? '';
};
await handleRoute();
addEventListener('hashchange', handleRoute);
addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    viewerController.dispose();
    session.dispose();
  }
});
addEventListener('pageshow', (event) => { if (event.persisted) handleRoute(); });
