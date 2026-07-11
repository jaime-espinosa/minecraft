import { createAvatarKernel } from './src/avatar-kernel/kernel.js';
import { createMinecraftCompiler } from './src/compilers/minecraft/compiler.js';
import { resolveRoute } from './src/routing/resolve-route.js';
import { resolvePresentationConfig } from './src/presentation/config.js';
import { renderStudioShell } from './src/presentation/shell.js';
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

const handleRoute = async () => {
  const route = resolveRoute(location.hash);
  if (location.hash !== route.route) history.replaceState(null, '', route.route);
  await session.dispatch({ type: 'navigate', route: route.route });
  document.querySelector('#route-notice').textContent = route.notice ?? '';
};
await handleRoute();
addEventListener('hashchange', handleRoute);
addEventListener('pagehide', (event) => { if (!event.persisted) session.dispose(); });
addEventListener('pageshow', (event) => { if (event.persisted) handleRoute(); });
