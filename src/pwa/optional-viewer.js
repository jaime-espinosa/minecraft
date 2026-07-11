export function createOptionalMinecraftViewerController({ load, show, hide, unavailable }) {
  let generation = 0;
  let desiredUrl = null;
  let currentUrl = null;
  let viewer = null;
  let blocked = false;
  let loadToken = 0;

  const disposeViewer = () => {
    viewer?.dispose();
    viewer = null;
    currentUrl = null;
  };

  return Object.freeze({
    setTextureUrl(url) {
      const next = url || null;
      if (next === desiredUrl && next !== null) return;
      generation += 1;
      loadToken += 1;
      desiredUrl = next;
      disposeViewer();
      hide();
    },
    async loadTexture(texture, url, slim) {
      if (!url || url !== desiredUrl || blocked) return false;
      if (viewer && currentUrl === url) {
        viewer.updateMinecraftTexture(texture);
        viewer.setSlim(slim);
        show();
        return true;
      }
      const expectedGeneration = generation;
      const expectedLoadToken = ++loadToken;
      try {
        const candidate = await load(texture, slim);
        if (expectedGeneration !== generation || expectedLoadToken !== loadToken || desiredUrl !== url) {
          candidate.dispose();
          return false;
        }
        disposeViewer();
        viewer = candidate;
        currentUrl = url;
        viewer.setSlim(slim);
        show();
        return true;
      } catch (error) {
        if (expectedGeneration === generation && expectedLoadToken === loadToken && desiredUrl === url) {
          blocked = true;
          hide();
          unavailable(error);
        }
        return false;
      }
    },
    dispose() {
      generation += 1;
      loadToken += 1;
      desiredUrl = null;
      disposeViewer();
      hide();
    },
  });
}
