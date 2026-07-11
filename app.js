import { bootstrapMyAvatars } from './src/integration/bootstrap.js';
import { createAppController } from './src/integration/app-controller.js';
import { resolvePresentationConfig } from './src/presentation/config.js';

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
for (const [name, value] of Object.entries(config.tokens)) {
  document.documentElement.style.setProperty(tokenVariables[name], value);
}

const runtime = await bootstrapMyAvatars({
  indexedDB: globalThis.indexedDB,
  storageEstimate: () => navigator.storage?.estimate?.() ?? {},
  urls: {
    createObjectURL(bytes, mediaType) { return URL.createObjectURL(new Blob([bytes], { type: mediaType })); },
    revokeObjectURL(url) { URL.revokeObjectURL(url); },
  },
});

createAppController({ document, window, runtime, config }).start();
