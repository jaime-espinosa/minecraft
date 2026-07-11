import { resolveRoute } from '../routing/resolve-route.js';
import { renderStudioShell } from '../presentation/shell.js';
import { createOptionalMinecraftViewerController } from '../pwa/optional-viewer.js';
import { createExportController } from './export-controller.js';
import { createLibraryController } from './library-controller.js';
import { createBackupController } from './backup-controller.js';

export function createAppController({ document, window, runtime, config }) {
  const session = runtime.session;
  const disposers = [];
  const viewerContainer = document.querySelector('#minecraft-avatar-viewer');
  const viewerNotice = document.querySelector('#minecraft-viewer-notice');
  const texture = document.querySelector('#minecraft-texture-image');
  let capture = null;
  let captureLoad = null;
  let navigationToken = 0;
  let pendingUpdate = null;
  let started = false;

  const viewer = createOptionalMinecraftViewerController({
    load: (image) => import('../../viewer.js').then(({ createMinecraftAvatarViewer }) => (
      createMinecraftAvatarViewer(viewerContainer, image)
    )),
    show() {
      viewerContainer.hidden = false;
      viewerNotice.hidden = true;
    },
    hide() {
      viewerContainer.hidden = true;
    },
    unavailable() {
      viewerNotice.hidden = false;
      viewerNotice.textContent = '3D preview is unavailable. Your exact 2D preview and download still work.';
    },
  });

  const navigateToManual = () => {
    window.location.hash = '#/studio';
    window.setTimeout(() => {
      document.querySelector('#manual-complexion')?.focus();
      document.querySelector('#status').textContent = 'Manual color controls are ready.';
    }, 0);
  };

  const loadCapture = async () => {
    if (capture) return capture;
    if (!captureLoad) {
      captureLoad = import('./capture-controller.js').then(({ createCaptureController }) => (
        createCaptureController({
          document,
          session,
          localPhotos: runtime.localPhotos,
          urlApi: window.URL,
          onManualCorrection: navigateToManual,
        })
      ));
    }
    try {
      capture = await captureLoad;
      return capture;
    } catch (error) {
      captureLoad = null;
      throw error;
    }
  };

  const handleRoute = async () => {
    const token = ++navigationToken;
    const resolved = resolveRoute(window.location.hash);
    if (window.location.hash !== resolved.route) {
      window.history.replaceState(null, '', resolved.route);
    }
    await session.dispatch({ type: 'navigate', route: resolved.route });
    const routeNotice = document.querySelector('#route-notice');
    routeNotice.textContent = resolved.notice ?? '';
    if (resolved.route === '#/experimental/capture') {
      try {
        const controller = await loadCapture();
        if (token !== navigationToken) {
          await controller.setRoute(resolveRoute(window.location.hash).route);
          return;
        }
        await controller.setRoute(resolved.route);
      } catch {
        routeNotice.textContent = 'Optional local capture could not load. Build, library, and exports still work.';
      }
      return;
    }
    if (capture) await capture.setRoute(resolved.route);
  };

  const handlePageHide = (event) => {
    if (event.persisted) return;
    disposers.splice(0).forEach((dispose) => dispose());
    capture?.dispose();
    viewer.dispose();
    runtime.dispose();
  };

  const registerServiceWorker = () => import('../pwa/register-service-worker.js')
    .then(({ registerMyAvatarsServiceWorker }) => registerMyAvatarsServiceWorker({
      getUpdateSafety: runtime.getUpdateSafety,
      onReloadDeferred() {
        document.querySelector('#pwa-update-message').textContent = 'Save this look before reloading.';
      },
      onUpdate(update) {
        pendingUpdate = update;
        document.querySelector('#pwa-update-notice').hidden = false;
        document.querySelector('#pwa-update-message').textContent = 'An offline update is ready.';
      },
    }))
    .catch(() => {
      document.querySelector('#pwa-update-notice').hidden = false;
      document.querySelector('#reload-update').hidden = true;
      document.querySelector('#pwa-update-message').textContent = 'Offline installation is unavailable. Editing and downloads still work.';
    });

  return Object.freeze({
    async start() {
      if (started) return;
      started = true;
      disposers.push(renderStudioShell(document, session, config));
      const exports = createExportController({ document, session });
      const library = createLibraryController({
        document,
        session,
        confirm: window.confirm.bind(window),
      });
      const backups = createBackupController({
        document,
        libraryBackups: runtime.libraryBackups,
        confirm: window.confirm.bind(window),
        urlApi: window.URL,
        reload: () => window.location.reload(),
      });
      disposers.push(() => exports.dispose(), () => library.dispose(), () => backups.dispose());
      if (runtime.notice) document.querySelector('#status').textContent = runtime.notice;
      texture.addEventListener('load', () => {
        viewer.loadTexture(
          texture,
          session.getViewModel().previews.minecraft.url,
          document.querySelector('#slim').checked,
        );
      });
      disposers.push(session.subscribe((model) => viewer.setTextureUrl(model.previews.minecraft.url)));
      document.querySelector('#reload-update').addEventListener('click', () => {
        session.dispatch({
          type: 'reload-update',
          activate: () => pendingUpdate?.activateWhenSafe(),
        });
      });
      window.addEventListener('hashchange', handleRoute);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) handleRoute();
      });
      window.addEventListener('load', registerServiceWorker);
      await handleRoute();
    },
  });
}
