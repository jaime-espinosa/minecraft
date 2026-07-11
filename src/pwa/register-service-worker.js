export async function registerMyAvatarsServiceWorker({ navigatorObject = navigator, getUpdateSafety = () => ({ hasUnsavedDraft: true, hasMigration: true }), onReloadDeferred = () => {}, onUpdate = () => {}, reload = () => location.reload() } = {}) {
  if (!navigatorObject?.serviceWorker) return null;
  const registration = await navigatorObject.serviceWorker.register('/my-avatars/sw.js', { scope: '/my-avatars/', type: 'module', updateViaCache: 'none' });
  let reloadRequested = false;
  let reloadDeferred = false;
  const isSafe = async () => { const safety = await getUpdateSafety(); return !safety?.hasUnsavedDraft && !safety?.hasMigration; };
  navigatorObject.serviceWorker.addEventListener('controllerchange', async () => {
    if (!reloadRequested) return;
    reloadRequested = false;
    if (await isSafe()) reload();
    else { reloadDeferred = true; onReloadDeferred(); }
  });
  const announce = (worker) => {
    if (!worker) return;
    const reloadWhenSafe = async () => {
      if (!reloadDeferred || !await isSafe()) return false;
      reloadDeferred = false;
      reload();
      return true;
    };
    onUpdate({
      reloadWhenSafe,
      async activateWhenSafe() {
        if (reloadDeferred) return reloadWhenSafe();
        const target = registration.waiting ?? worker;
        if (!target || !await isSafe()) return false;
        reloadRequested = true;
        try { target.postMessage({ type: 'ACTIVATE_UPDATE' }); }
        catch { reloadRequested = false; return false; }
        return true;
      },
    });
  };
  if (navigatorObject.serviceWorker.controller) announce(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigatorObject.serviceWorker.controller) announce(registration.waiting ?? installing);
    });
  });
  return registration;
}
