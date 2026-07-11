const renderChecks = (document, target, report) => {
  target.replaceChildren(...(report?.checks ?? []).map((item) => {
    const row = document.createElement('li');
    row.textContent = `${item.passed ? 'Passed' : 'Failed'}: ${item.message}`;
    row.dataset.passed = String(item.passed);
    return row;
  }));
};

export function createExportController({ document, session }) {
  const minecraftDownload = document.querySelector('#download-minecraft');
  const robloxDownload = document.querySelector('#download-roblox-classic');
  const shirt = document.querySelector('#roblox-shirt-preview');
  const pants = document.querySelector('#roblox-pants-preview');
  const outerLayers = document.querySelector('#minecraft-outer-layers');
  const robloxNotice = document.querySelector('#roblox-notice');
  const render = (model) => {
    for (const [anchor, preview] of [[minecraftDownload, model.previews.minecraft], [robloxDownload, model.previews.robloxClassic]]) {
      anchor.hidden = !preview.url;
      if (preview.url) anchor.href = preview.url; else anchor.removeAttribute('href');
    }
    for (const [image, url] of [[shirt, model.previews.robloxClassic.shirtUrl], [pants, model.previews.robloxClassic.pantsUrl]]) {
      image.hidden = !url;
      if (url) image.src = url; else image.removeAttribute('src');
    }
    outerLayers.checked = model.editor.platformProfiles.minecraft.outerLayers;
    robloxNotice.checked = model.editor.platformProfiles.robloxClassic.blockAvatarNoticeAccepted;
    renderChecks(document, document.querySelector('#minecraft-preflight'), model.previews.minecraft.preflight);
    renderChecks(document, document.querySelector('#roblox-preflight'), model.previews.robloxClassic.preflight);
  };
  const editMinecraft = () => {
    const model = session.getViewModel();
    session.dispatch({ type: 'edit', baseRevision: model.activeRecipe.revision, minecraftProfile: { ...model.editor.platformProfiles.minecraft, outerLayers: outerLayers.checked } });
  };
  const editRoblox = () => {
    const model = session.getViewModel();
    session.dispatch({ type: 'edit', baseRevision: model.activeRecipe.revision, robloxProfile: { blockAvatarNoticeAccepted: robloxNotice.checked } });
  };
  const compileMinecraft = () => session.dispatch({ type: 'compile-minecraft' });
  const compileRoblox = () => session.dispatch({ type: 'compile-roblox-classic' });
  outerLayers.addEventListener('change', editMinecraft);
  robloxNotice.addEventListener('change', editRoblox);
  document.querySelector('#compile-minecraft').addEventListener('click', compileMinecraft);
  document.querySelector('#compile-roblox-classic').addEventListener('click', compileRoblox);
  const unsubscribe = session.subscribe(render);
  return Object.freeze({ dispose() { unsubscribe(); } });
}
