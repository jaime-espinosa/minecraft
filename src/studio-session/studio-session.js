import { err, ok } from '../domain/result.js';
import { validateMinecraftProfileV1, validateProposedIdentityChangeV1, validateRobloxClassicProfileV1 } from '../domain/contracts.js';
import { resolveRoute } from '../routing/resolve-route.js';
import { createMemoryLibrary } from './memory-library.js';
import { createStudioViewModel } from './view-model.js';

export const STUDIO_ACTIONS = Object.freeze([
  'navigate', 'edit', 'save-look', 'select-look', 'delete-look', 'request-reset-person',
  'confirm-reset-person', 'add-photo', 'delete-photo', 'delete-all-photos', 'analyze',
  'delete-unused-photos',
  'accept-proposal', 'reject-proposal', 'compile-minecraft', 'compile-roblox-classic',
  'download', 'reload-update', 'dismiss-fault',
]);

export function createStudioSession({ kernel, initialFrame = null, library: injectedLibrary = null, minecraftCompiler, robloxClassicCompiler = null, urls, reportUpdateSafety = () => {} } = {}) {
  if (!kernel) throw new TypeError('StudioSession requires an avatar kernel');
  const fallbackUrls = (() => {
    let next = 0;
    return {
      createObjectURL: () => `memory:${++next}`,
      revokeObjectURL() {},
    };
  })();
  const urlApi = urls ?? fallbackUrls;
  let frame = initialFrame ?? kernel.start().value;
  const library = injectedLibrary ?? createMemoryLibrary(frame.recipe);
  let unsavedDraft = false;
  let identityDirty = false;
  let recipeDirty = false;
  let identityBaseRevision = frame.identity.revision;
  let route = '#/studio';
  let announcement = 'Your avatar is ready. No photo is required.';
  let fault = null;
  let currentProposal = null;
  const platforms = {
    minecraft: { url: null, preflight: null, status: 'idle', filename: null },
    robloxClassic: { url: null, shirtUrl: null, pantsUrl: null, preflight: null, status: 'idle', filename: null },
  };
  let disposed = false;
  let generation = 0;
  let analysisToken = 0;
  const compileTokens = { minecraft: 0, robloxClassic: 0 };
  let fallbackRecipeSequence = Math.max(1, ...library.list().map(({ id }) => Number(/^avatar-(\d+)$/.exec(id)?.[1] ?? 0)));
  const listeners = new Set();

  const publicPlatforms = () => Object.fromEntries(Object.entries(platforms).map(([key, slot]) => [key, {
    url: slot.url,
    preflight: slot.preflight,
    status: slot.status,
    filename: slot.filename,
    ...(key === 'robloxClassic' ? { shirtUrl: slot.shirtUrl, pantsUrl: slot.pantsUrl } : {}),
  }]));
  const view = () => createStudioViewModel({ frame, recipes: library.list(), route, proposal: currentProposal, photos: library.listPhotos?.() ?? [], platforms: publicPlatforms(), busy: Object.values(platforms).some(({ status }) => status === 'working'), fault, announcement });
  const emit = () => {
    reportUpdateSafety({ hasUnsavedDraft: unsavedDraft || identityDirty || recipeDirty, hasMigration: library.hasMigration?.() === true });
    const model = view();
    listeners.forEach((listener) => listener(model));
  };
  const setFault = (nextFault) => {
    fault = nextFault;
    announcement = nextFault.message;
    emit();
    return err(nextFault);
  };

  const invalidateOutputs = () => {
    generation += 1;
    for (const slot of Object.values(platforms)) {
      for (const url of [slot.url, slot.shirtUrl, slot.pantsUrl]) if (url) urlApi.revokeObjectURL(url);
      Object.assign(slot, { url: null, shirtUrl: null, pantsUrl: null, preflight: null, status: 'idle', filename: null });
    }
  };
  const invalidateProposal = () => {
    analysisToken += 1;
    currentProposal = null;
  };
  const applyPhotoDeletion = (deletedId = null) => {
    const next = structuredClone(frame);
    for (const provenance of Object.values(next.identity.provenance)) {
      if (provenance.source !== 'photo-analysis') continue;
      if (deletedId === null || provenance.sourcePhotoIds.includes(deletedId)) {
        provenance.sourcePhotoIds = [];
        provenance.evidenceState = 'deleted';
      }
    }
    const started = kernel.start(next);
    if (started.ok) frame = started.value;
  };
  const compile = async (compiler, platform, key) => {
    if (!compiler) return setFault({ kind: 'compiler-unavailable', message: `${platform} export is not available yet.` });
    const token = ++compileTokens[key];
    const startGeneration = generation;
    const slot = platforms[key];
    let createdUrls = [];
    slot.status = 'working';
    fault = null;
    announcement = `Compiling ${platform}…`;
    emit();
    try {
      const snapshot = await kernel.snapshot(frame);
      const profile = key === 'minecraft' ? frame.recipe.platformProfiles.minecraft : frame.recipe.platformProfiles.robloxClassic;
      const result = await compiler.compile({ snapshot, profile });
      if (!result.ok) {
        if (token !== compileTokens[key] || startGeneration !== generation) return result;
        slot.status = 'fault';
        return setFault(result.fault);
      }
      const preflight = await compiler.preflight(result.value);
      if (token !== compileTokens[key] || startGeneration !== generation || disposed) {
        return err({ kind: 'stale-result', message: 'Discarded stale compiler result.' });
      }
      if (!preflight?.passed) {
        slot.preflight = preflight ?? null;
        slot.status = 'fault';
        return setFault({ kind: 'preflight-failed', message: `${platform} local preflight failed.` });
      }
      const artifact = result.value.artifacts[0];
      createdUrls.push(urlApi.createObjectURL(artifact.bytes, artifact.mediaType));
      if (key === 'robloxClassic' && typeof compiler.extractPreview === 'function') {
        const extracted = await compiler.extractPreview(result.value);
        if (!extracted.ok) {
          createdUrls.forEach((url) => urlApi.revokeObjectURL(url));
          slot.status = 'fault';
          return setFault(extracted.fault);
        }
        for (const preview of extracted.value) createdUrls.push(urlApi.createObjectURL(preview.bytes, preview.mediaType));
      }
      if (token !== compileTokens[key] || startGeneration !== generation || disposed) {
        createdUrls.forEach((url) => urlApi.revokeObjectURL(url));
        return err({ kind: 'stale-result', message: 'Discarded stale compiler result.' });
      }
      for (const url of [slot.url, slot.shirtUrl, slot.pantsUrl]) if (url) urlApi.revokeObjectURL(url);
      const previewByName = key === 'robloxClassic' && createdUrls.length === 3
        ? { pantsUrl: createdUrls[1], shirtUrl: createdUrls[2] } : {};
      Object.assign(slot, { url: createdUrls[0], ...previewByName, preflight, status: 'ready', filename: artifact.filename });
      createdUrls = [];
      announcement = `${platform} export is ready.`;
      emit();
      return ok(result.value);
    } catch (error) {
      createdUrls.forEach((url) => urlApi.revokeObjectURL(url));
      if (token !== compileTokens[key] || startGeneration !== generation) return err({ kind: 'stale-result', message: 'Discarded stale compiler result.' });
      slot.status = 'fault';
      return setFault({ kind: 'compiler-exception', message: error?.message || `${platform} compiler failed.` });
    } finally {
      if (token === compileTokens[key]) emit();
    }
  };

  reportUpdateSafety({ hasUnsavedDraft: unsavedDraft, hasMigration: library.hasMigration?.() === true });
  return Object.freeze({
    getViewModel() { return view(); },
    subscribe(listener) {
      listeners.add(listener);
      listener(view());
      return () => listeners.delete(listener);
    },
    async dispatch(action) {
      if (disposed) return err({ kind: 'disposed', message: 'Studio session is closed.' });
      if (!action || !STUDIO_ACTIONS.includes(action.type)) return setFault({ kind: 'unsupported-action', message: 'That action is not supported.' });
      fault = null;
      if (action.type === 'navigate') {
        const resolved = resolveRoute(action.route);
        route = resolved.route;
        announcement = resolved.notice ?? `Opened ${route.slice(2)}.`;
        emit();
        return ok(route);
      }
      if (action.type === 'edit') {
        if (action.robloxProfile) {
          if (action.baseRevision !== frame.recipe.revision) return setFault({ kind: 'revision-conflict', message: 'That edit is stale.' });
          try {
            validateRobloxClassicProfileV1(action.robloxProfile);
          } catch (error) {
            return setFault({ kind: 'invalid-operation', message: error.message });
          }
          const seed = structuredClone(frame);
          seed.recipe.platformProfiles.robloxClassic = structuredClone(action.robloxProfile);
          seed.recipe.revision += 1;
          const started = kernel.start(seed);
          if (!started.ok) return setFault(started.fault);
          invalidateOutputs();
          frame = started.value;
          recipeDirty = true;
          unsavedDraft = true;
          announcement = 'Roblox Classic profile updated.';
          emit();
          return ok(frame);
        }
        if (action.minecraftProfile) {
          if (action.baseRevision !== frame.recipe.revision) return setFault({ kind: 'revision-conflict', message: 'That edit is stale.' });
          try {
            validateMinecraftProfileV1(action.minecraftProfile);
          } catch (error) {
            return setFault({ kind: 'invalid-operation', message: error.message });
          }
          const seed = structuredClone(frame);
          seed.recipe.platformProfiles.minecraft = structuredClone(action.minecraftProfile);
          seed.recipe.revision += 1;
          const started = kernel.start(seed);
          if (!started.ok) return setFault(started.fault);
          invalidateOutputs();
          frame = started.value;
          recipeDirty = true;
          unsavedDraft = true;
          announcement = 'Minecraft profile updated.';
          emit();
          return ok(frame);
        }
        const result = kernel.transact({ frame, baseRevision: action.baseRevision, operations: action.operations });
        if (!result.ok) return setFault(result.fault);
        const identityChanged = result.value.identity.revision !== frame.identity.revision;
        if (identityChanged && !identityDirty) identityBaseRevision = frame.identity.revision;
        identityDirty = identityDirty || identityChanged;
        recipeDirty = recipeDirty || action.operations.some(({ op }) => op === 'set-style');
        invalidateOutputs();
        invalidateProposal();
        frame = result.value;
        unsavedDraft = true;
        announcement = 'Avatar updated.';
        emit();
        return result;
      }
      if (action.type === 'save-look') {
        if (action.label !== undefined && (typeof action.label !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} _'-]{0,39}$/u.test(action.label.trim()))) {
          return setFault({ kind: 'invalid-action', message: 'Look label must be safe text between 1 and 40 characters.' });
        }
        if (identityDirty && library.saveIdentityFrame) {
          const persistenceSeed = structuredClone(frame);
          persistenceSeed.identity.revision = identityBaseRevision + 1;
          persistenceSeed.recipe.identityRevision = persistenceSeed.identity.revision;
          const normalized = kernel.start(persistenceSeed);
          if (!normalized.ok) return setFault(normalized.fault);
          const persisted = await library.saveIdentityFrame(normalized.value, {
            baseRevision: identityBaseRevision,
          });
          if (persisted?.ok === false) return setFault(persisted.fault);
          frame = persisted?.value ?? normalized.value;
          identityDirty = false;
          identityBaseRevision = frame.identity.revision;
        }
        const reserved = library.nextRecipeId
          ? await library.nextRecipeId()
          : ok(`avatar-${++fallbackRecipeSequence}`);
        if (reserved?.ok === false) return setFault(reserved.fault);
        const recipeId = reserved?.value ?? reserved;
        const sequence = Number(/^avatar-(\d+)$/.exec(recipeId)?.[1]);
        if (!Number.isInteger(sequence)) return setFault({ kind: 'invalid-recipe-id', message: 'The local look allocator returned an invalid ID.' });
        const label = action.label === undefined ? `Avatar ${sequence}` : action.label;
        const recipe = structuredClone(frame.recipe);
        recipe.id = recipeId;
        recipe.localLabel = label.trim();
        recipe.revision = 1;
        const started = kernel.start({ identity: frame.identity, recipe });
        if (!started.ok) return setFault({ kind: 'invalid-action', message: started.fault.message });
        const saved = await library.save(recipe);
        if (saved?.ok === false) return setFault(saved.fault);
        invalidateOutputs();
        frame = started.value;
        unsavedDraft = false;
        identityDirty = false;
        recipeDirty = false;
        identityBaseRevision = frame.identity.revision;
        announcement = `Saved ${recipe.localLabel}.`;
        emit();
        return ok(recipe);
      }
      if (action.type === 'select-look') {
        const selected = await library.select(action.id);
        if (!selected || selected?.ok === false) {
          return setFault(selected?.fault ?? { kind: 'look-not-found', message: 'That saved look was not found.' });
        }
        const recipe = library.active();
        recipe.identityRevision = frame.identity.revision;
        invalidateOutputs();
        frame = kernel.start({ identity: frame.identity, recipe }).value;
        recipeDirty = false;
        unsavedDraft = identityDirty;
        announcement = `Selected ${recipe.localLabel}.`;
        emit();
        return ok(recipe);
      }
      if (action.type === 'delete-look') {
        const deletingActiveLook = action.id === frame.recipe.id;
        const deleted = await library.delete(action.id);
        if (!deleted || deleted?.ok === false) {
          return setFault(deleted?.fault ?? { kind: 'delete-rejected', message: 'Keep at least one saved look.' });
        }
        invalidateOutputs();
        let recipe = frame.recipe;
        if (deletingActiveLook) {
          recipe = library.active();
          recipe.identityRevision = frame.identity.revision;
          frame = kernel.start({ identity: frame.identity, recipe }).value;
          recipeDirty = false;
          unsavedDraft = identityDirty;
        }
        announcement = 'Saved look deleted.';
        emit();
        return ok(recipe);
      }
      if (action.type === 'request-reset-person') {
        announcement = 'Confirm deletion to start for another person.';
        emit();
        return ok('confirmation-required');
      }
      if (action.type === 'confirm-reset-person') {
        const started = kernel.start();
        if (!started.ok) return setFault(started.fault);
        const resetPromise = library.reset(started.value);
        reportUpdateSafety({ hasUnsavedDraft: unsavedDraft, hasMigration: true });
        const reset = await resetPromise;
        if (reset?.ok === false) return setFault(reset.fault);
        invalidateOutputs();
        invalidateProposal();
        frame = started.value;
        fallbackRecipeSequence = 1;
        unsavedDraft = false;
        identityDirty = false;
        recipeDirty = false;
        identityBaseRevision = frame.identity.revision;
        announcement = 'Started fresh for a new person with Avatar 1.';
        emit();
        return ok(frame);
      }
      if (action.type === 'compile-minecraft') return compile(minecraftCompiler, 'Minecraft', 'minecraft');
      if (action.type === 'compile-roblox-classic') return compile(robloxClassicCompiler, 'Roblox Classic', 'robloxClassic');
      if (action.type === 'add-photo') {
        const result = await library.storeNormalizedPhoto?.(action.envelope);
        if (!result || result.ok === false) return setFault(result?.fault ?? { kind: 'storage-unavailable', message: 'Photo storage is unavailable.' });
        announcement = 'Local source photo confirmed.';
        emit();
        return ok(result.value ?? action.envelope);
      }
      if (action.type === 'delete-photo') {
        const result = await library.deletePhoto?.(action.id);
        if (result?.ok === false) return setFault(result.fault);
        invalidateProposal();
        applyPhotoDeletion(action.id);
        announcement = 'Local source photo deleted.';
        emit();
        return ok(null);
      }
      if (action.type === 'delete-all-photos') {
        const result = await library.deleteAllPhotos?.();
        if (result?.ok === false) return setFault(result.fault);
        invalidateProposal();
        applyPhotoDeletion();
        announcement = 'All local source photos deleted.';
        emit();
        return ok(null);
      }
      if (action.type === 'delete-unused-photos') {
        const usedIds = new Set(Object.values(frame.identity.provenance)
          .filter(({ source, evidenceState }) => source === 'photo-analysis' && evidenceState === 'available')
          .flatMap(({ sourcePhotoIds }) => sourcePhotoIds));
        const result = await library.deleteUnusedPhotos?.(usedIds);
        if (!result || result.ok === false) return setFault(result?.fault ?? { kind: 'storage-unavailable', message: 'Unused local photo cleanup is unavailable.' });
        invalidateProposal();
        announcement = 'Unused local source photos deleted.';
        emit();
        return ok(null);
      }
      if (action.type === 'analyze') {
        const token = ++analysisToken;
        currentProposal = null;
        let result;
        try { result = await action.analyzer?.analyze({ ...action.analysisInput, baseIdentityRevision: frame.identity.revision }); }
        catch (error) {
          if (disposed || token !== analysisToken) return err({ kind: 'stale-analysis', message: 'Discarded stale local analysis.' });
          return setFault({ kind: 'analysis-failed', message: error.message });
        }
        if (disposed || token !== analysisToken) return err({ kind: 'stale-analysis', message: 'Discarded stale local analysis.' });
        if (!result?.ok) return setFault(result?.fault ?? { kind: 'analysis-failed', message: 'Local analysis failed.' });
        if (action.transientEvidence) {
          result = structuredClone(result);
          result.value.evidencePhotoIds = [];
          for (const operation of result.value.operations) {
            operation.provenance.sourcePhotoIds = [];
            operation.provenance.evidenceState = 'deleted';
          }
        }
        try {
          validateProposedIdentityChangeV1(result.value);
        } catch (error) {
          return setFault({ kind: 'invalid-proposal', message: error.message });
        }
        const available = new Set((library.listPhotos?.() ?? []).map(({ id }) => id));
        if (result.value.evidencePhotoIds.some((id) => !available.has(id))) return setFault({ kind: 'invalid-evidence', message: 'Proposal evidence is no longer available.' });
        currentProposal = structuredClone(result.value);
        announcement = 'Review the local analysis proposal.';
        emit();
        return ok(view().proposal);
      }
      if (action.type === 'accept-proposal') {
        if (!currentProposal) return setFault({ kind: 'proposal-unavailable', message: 'Preview a proposal before accepting it.' });
        if (action.proposalId !== currentProposal.id) return setFault({ kind: 'proposal-mismatch', message: 'That proposal is not current.' });
        if (currentProposal.baseIdentityRevision !== frame.identity.revision) return setFault({ kind: 'stale-proposal', message: 'That proposal is stale.' });
        if(!Array.isArray(action.selectedFields)||new Set(action.selectedFields).size!==action.selectedFields.length)return setFault({kind:'invalid-selection',message:'Selected fields must be unique.'});
        const selected = new Set(action.selectedFields), operations = currentProposal.operations.filter(({ field }) => selected.has(field));
        if (!operations.length || selected.size !== operations.length) return setFault({ kind: 'invalid-selection', message: 'Choose valid proposed fields.' });
        const changed = kernel.transact({ frame, baseRevision: frame.recipe.revision, operations });
        if (!changed.ok) return setFault(changed.fault);
        const persistenceBase = identityDirty ? identityBaseRevision : frame.identity.revision;
        const persistenceSeed = structuredClone(changed.value);
        persistenceSeed.identity.revision = persistenceBase + 1;
        persistenceSeed.recipe.identityRevision = persistenceSeed.identity.revision;
        const normalized = kernel.start(persistenceSeed);
        if (!normalized.ok) return setFault(normalized.fault);
        const persisted = await library.saveIdentityFrame?.(normalized.value, { baseRevision: persistenceBase });
        if (persisted?.ok === false) return setFault(persisted.fault);
        invalidateOutputs();
        frame = persisted?.value ?? normalized.value;
        invalidateProposal();
        identityDirty = false;
        identityBaseRevision = frame.identity.revision;
        unsavedDraft = recipeDirty;
        announcement = 'Selected local proposal fields accepted.';
        emit();
        return ok(frame);
      }
      if (action.type === 'reject-proposal') {
        invalidateProposal();
        announcement = 'Proposal rejected. Your avatar is unchanged.';
        emit();
        return ok(null);
      }
      if (action.type === 'reload-update') {
        if (unsavedDraft || identityDirty || recipeDirty || library.hasMigration?.() === true) return setFault({ kind: 'reload-deferred', message: 'Save this look before reloading.' });
        action.activate?.();
        return ok(null);
      }
      if (action.type === 'dismiss-fault') {
        fault = null;
        announcement = 'Notice dismissed.';
        emit();
        return ok(null);
      }
      announcement = 'This privacy-safe action is staged for the local library milestone.';
      emit();
      return err({ kind: 'not-yet-available', message: announcement });
    },
    dispose() {
      disposed = true;
      invalidateProposal();
      invalidateOutputs();
      library.dispose?.();
      listeners.clear();
    },
  });
}
