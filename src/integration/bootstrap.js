import { createAvatarKernel } from '../avatar-kernel/kernel.js';
import { createMinecraftCompiler } from '../compilers/minecraft/compiler.js';
import { createRobloxClassicCompiler } from '../compilers/roblox-classic/compiler.js';
import { openIdentityLibrary } from '../identity-library/repository.js';
import { exportLibraryBackup, importLibraryBackup, restoreLibraryBackupAsNewPerson } from '../identity-library/backup.js';
import { createMemoryLibrary } from '../studio-session/memory-library.js';
import { createStudioSession } from '../studio-session/studio-session.js';
import { createDurableLibraryAdapter } from './durable-library.js';

const latest = (values, field = 'revision') => [...values].sort((a, b) => a[field] - b[field]).at(-1);

export async function bootstrapMyAvatars({ indexedDB, databaseName, storageEstimate, clock, createId, minecraftCompiler = createMinecraftCompiler(), robloxClassicCompiler = createRobloxClassicCompiler(), urls } = {}) {
  const kernel = createAvatarKernel();
  let repository = null, library = null, initialFrame = null, storageMode = 'memory', notice = '';
  try {
    const opened = await openIdentityLibrary({ indexedDB, databaseName, storageEstimate, clock, createId });
    if (!opened.ok) throw new Error(opened.fault.message);
    repository = opened.value;
    const document = await repository.readLibrary();
    const identity = latest(document.identities), active = document.recipes.find(({ id }) => id === document.meta?.activeRecipeId) ?? latest(document.recipes);
    const started = kernel.start({ identity, recipe: active });
    if (!started.ok) throw new Error(started.fault.message);
    initialFrame = started.value;
    library = createDurableLibraryAdapter({ repository, libraryDocument: document });
    storageMode = 'durable';
  } catch (error) {
    repository?.db?.close(); repository = null; library = null; initialFrame = null;
    notice = `Local storage is unavailable; continuing safely in memory. ${error.message}`;
  }
  if (!library) {
    initialFrame = kernel.start().value;
    library = createMemoryLibrary(initialFrame.recipe);
  }
  let updateSafety = Object.freeze({ hasUnsavedDraft: false, hasMigration: false });
  const session = createStudioSession({
    kernel,
    initialFrame,
    library,
    minecraftCompiler,
    robloxClassicCompiler,
    urls,
    reportUpdateSafety(value) { updateSafety = Object.freeze({ ...value }); },
  });
  const localPhotos = Object.freeze({
    get(id) {
      return library?.getNormalizedPhoto?.(id)
        ?? Promise.resolve({ ok: false, fault: { kind: 'storage-unavailable', message: 'That local source photo is not available.' } });
    },
  });
  const libraryBackups = Object.freeze({
    async export() {
      if (!repository) return { ok: false, fault: { kind: 'storage-unavailable', message: 'Durable local storage is required for a library backup.' } };
      const result = await exportLibraryBackup(repository);
      return result.ok
        ? { ok: true, value: { ...result.value, filename: 'my-avatars-library-backup.json' } }
        : result;
    },
    import(input, options) {
      return repository
        ? importLibraryBackup(repository, input, options)
        : Promise.resolve({ ok: false, fault: { kind: 'storage-unavailable', message: 'Durable local storage is required to import a library backup.' } });
    },
    restoreAsNewPerson(input, options) {
      return repository
        ? restoreLibraryBackupAsNewPerson(repository, input, options)
        : Promise.resolve({ ok: false, fault: { kind: 'storage-unavailable', message: 'Durable local storage is required for disaster recovery.' } });
    },
  });
  return Object.freeze({
    session, storageMode, notice, localPhotos, libraryBackups,
    getUpdateSafety() { return updateSafety; },
    dispose() { session.dispose(); repository?.db?.close(); },
  });
}
