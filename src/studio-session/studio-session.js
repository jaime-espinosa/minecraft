import { err, ok } from '../domain/result.js';
import { validateMinecraftProfileV1 } from '../domain/contracts.js';
import { resolveRoute } from '../routing/resolve-route.js';
import { createMemoryLibrary } from './memory-library.js';
import { createStudioViewModel } from './view-model.js';

export const STUDIO_ACTIONS = Object.freeze([
  'navigate', 'edit', 'save-look', 'select-look', 'delete-look', 'request-reset-person',
  'confirm-reset-person', 'add-photo', 'delete-photo', 'delete-all-photos', 'analyze',
  'accept-proposal', 'reject-proposal', 'compile-minecraft', 'compile-roblox-classic',
  'download', 'reload-update', 'dismiss-fault',
]);

export function createStudioSession({ kernel, library: injectedLibrary = null, minecraftCompiler, robloxClassicCompiler = null, urls } = {}) {
  if (!kernel) throw new TypeError('StudioSession requires an avatar kernel');
  const fallbackUrls = (() => { let next = 0; return { createObjectURL: () => `memory:${++next}`, revokeObjectURL() {} }; })();
  const urlApi = urls ?? fallbackUrls;
  let frame = kernel.start().value;
  const library = injectedLibrary ?? createMemoryLibrary(frame.recipe);
  let unsavedDraft = false;
  let route = '#/studio';
  let announcement = 'Your avatar is ready. No photo is required.';
  let fault = null;
  const platforms = {
    minecraft: { url: null, preflight: null, status: 'idle', filename: null, bundle: null },
    robloxClassic: { url: null, preflight: null, status: 'idle', filename: null, bundle: null },
  };
  let disposed = false;
  let generation = 0;
  const compileTokens = { minecraft: 0, robloxClassic: 0 };
  let nextRecipe = 2;
  const listeners = new Set();

  const publicPlatforms = () => Object.fromEntries(Object.entries(platforms).map(([key, slot]) => [key, {
    url: slot.url,
    preflight: slot.preflight,
    status: slot.status,
    filename: slot.filename,
  }]));
  const view = () => createStudioViewModel({ frame, recipes: library.list(), route, platforms: publicPlatforms(), busy: Object.values(platforms).some(({ status }) => status === 'working'), fault, announcement });
  const emit = () => { const model = view(); listeners.forEach((listener) => listener(model)); };
  const setFault = (nextFault) => { fault = nextFault; announcement = nextFault.message; emit(); return err(nextFault); };

  const invalidateOutputs = () => {
    generation += 1;
    for (const slot of Object.values(platforms)) {
      if (slot.url) urlApi.revokeObjectURL(slot.url);
      Object.assign(slot, { url: null, preflight: null, status: 'idle', filename: null, bundle: null });
    }
  };
  const compile = async (compiler, platform, key) => {
    if (!compiler) return setFault({ kind: 'compiler-unavailable', message: `${platform} export is not available yet.` });
    const token = ++compileTokens[key];
    const startGeneration = generation;
    const slot = platforms[key];
    slot.status = 'working'; fault = null; announcement = `Compiling ${platform}…`; emit();
    try {
      const snapshot = await kernel.snapshot(frame);
      const profile = key === 'minecraft' ? frame.recipe.platformProfiles.minecraft : frame.recipe.platformProfiles.robloxClassic;
      const result = await compiler.compile({ snapshot, profile });
      if (!result.ok) {
        if (token !== compileTokens[key] || startGeneration !== generation) return result;
        slot.status = 'fault'; return setFault(result.fault);
      }
      const preflight = await compiler.preflight(result.value);
      if (token !== compileTokens[key] || startGeneration !== generation || disposed) {
        return err({ kind: 'stale-result', message: 'Discarded stale compiler result.' });
      }
      if (!preflight?.passed) {
        slot.preflight = preflight ?? null; slot.status = 'fault';
        return setFault({ kind: 'preflight-failed', message: `${platform} local preflight failed.` });
      }
      const artifact = result.value.artifacts[0];
      const createdUrl = urlApi.createObjectURL(artifact.bytes, artifact.mediaType);
      if (token !== compileTokens[key] || startGeneration !== generation || disposed) {
        urlApi.revokeObjectURL(createdUrl);
        return err({ kind: 'stale-result', message: 'Discarded stale compiler result.' });
      }
      if (slot.url) urlApi.revokeObjectURL(slot.url);
      Object.assign(slot, { url: createdUrl, preflight, status: 'ready', filename: artifact.filename, bundle: result.value });
      announcement = `${platform} export is ready.`; emit();
      return ok(result.value);
    } catch (error) {
      if (token !== compileTokens[key] || startGeneration !== generation) return err({ kind: 'stale-result', message: 'Discarded stale compiler result.' });
      slot.status = 'fault';
      return setFault({ kind: 'compiler-exception', message: error?.message || `${platform} compiler failed.` });
    } finally {
      if (token === compileTokens[key]) emit();
    }
  };

  return Object.freeze({
    getViewModel() { return view(); },
    getUpdateSafety() { return Object.freeze({ hasUnsavedDraft: unsavedDraft, hasMigration: library.hasMigration?.() === true }); },
    subscribe(listener) { listeners.add(listener); listener(view()); return () => listeners.delete(listener); },
    async dispatch(action) {
      if (disposed) return err({ kind: 'disposed', message: 'Studio session is closed.' });
      if (!action || !STUDIO_ACTIONS.includes(action.type)) return setFault({ kind: 'unsupported-action', message: 'That action is not supported.' });
      fault = null;
      if (action.type === 'navigate') {
        const resolved = resolveRoute(action.route); route = resolved.route; announcement = resolved.notice ?? `Opened ${route.slice(2)}.`; emit(); return ok(route);
      }
      if (action.type === 'edit') {
        if (action.minecraftProfile) {
          if (action.baseRevision !== frame.recipe.revision) return setFault({ kind: 'revision-conflict', message: 'That edit is stale.' });
          try { validateMinecraftProfileV1(action.minecraftProfile); } catch (error) { return setFault({ kind: 'invalid-operation', message: error.message }); }
          const seed = structuredClone(frame);
          seed.recipe.platformProfiles.minecraft = structuredClone(action.minecraftProfile);
          seed.recipe.revision += 1;
          const started = kernel.start(seed);
          if (!started.ok) return setFault(started.fault);
          invalidateOutputs(); frame = started.value; unsavedDraft = true; announcement = 'Minecraft profile updated.'; emit(); return ok(frame);
        }
        const result = kernel.transact({ frame, baseRevision: action.baseRevision, operations: action.operations });
        if (!result.ok) return setFault(result.fault);
        invalidateOutputs(); frame = result.value; unsavedDraft = true; announcement = 'Avatar updated.'; emit(); return result;
      }
      if (action.type === 'save-look') {
        const defaultLabel = `Avatar ${nextRecipe}`;
        const label = action.label === undefined ? defaultLabel : action.label;
        if (typeof label !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} _'-]{0,39}$/u.test(label.trim())) {
          return setFault({ kind: 'invalid-action', message: 'Look label must be safe text between 1 and 40 characters.' });
        }
        const recipe = structuredClone(frame.recipe);
        recipe.id = `avatar-${nextRecipe}`; recipe.localLabel = label.trim(); recipe.revision = 1;
        const started = kernel.start({ identity: frame.identity, recipe });
        if (!started.ok) return setFault({ kind: 'invalid-action', message: started.fault.message });
        invalidateOutputs(); library.save(recipe); frame = started.value; nextRecipe += 1; unsavedDraft = false;
        announcement = `Saved ${recipe.localLabel}.`; emit(); return ok(recipe);
      }
      if (action.type === 'select-look') {
        if (!library.select(action.id)) return setFault({ kind: 'look-not-found', message: 'That saved look was not found.' });
        const recipe = library.active(); recipe.identityRevision = frame.identity.revision;
        invalidateOutputs(); frame = kernel.start({ identity: frame.identity, recipe }).value; unsavedDraft = false; announcement = `Selected ${recipe.localLabel}.`; emit(); return ok(recipe);
      }
      if (action.type === 'delete-look') {
        if (!library.delete(action.id)) return setFault({ kind: 'delete-rejected', message: 'Keep at least one saved look.' });
        const recipe = library.active(); recipe.identityRevision = frame.identity.revision;
        invalidateOutputs(); frame = kernel.start({ identity: frame.identity, recipe }).value; announcement = 'Saved look deleted.'; emit(); return ok(recipe);
      }
      if (action.type === 'request-reset-person') { announcement = 'Confirm deletion to start for another person.'; emit(); return ok('confirmation-required'); }
      if (action.type === 'confirm-reset-person') {
        const started = kernel.start();
        if (!started.ok) return setFault(started.fault);
        invalidateOutputs(); frame = started.value; library.reset(frame.recipe); nextRecipe = 2; unsavedDraft = false;
        announcement = 'Started fresh for a new person with Avatar 1.'; emit(); return ok(frame);
      }
      if (action.type === 'compile-minecraft') return compile(minecraftCompiler, 'Minecraft', 'minecraft');
      if (action.type === 'compile-roblox-classic') return compile(robloxClassicCompiler, 'Roblox Classic', 'robloxClassic');
      if (action.type === 'dismiss-fault') { fault = null; announcement = 'Notice dismissed.'; emit(); return ok(null); }
      announcement = 'This privacy-safe action is staged for the local library milestone.'; emit();
      return err({ kind: 'not-yet-available', message: announcement });
    },
    dispose() { disposed = true; invalidateOutputs(); listeners.clear(); },
  });
}
