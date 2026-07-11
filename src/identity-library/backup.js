import { canonicalJson } from '../domain/canonical-json.js';
import { validateIdentityProfileV1, validateAvatarRecipeV1 } from '../domain/contracts.js';
import { err, ok } from '../domain/result.js';

const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).every((key) => typeof key === 'string' && keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key));
const sanitizeIdentity = (identity) => {
  const next = structuredClone(identity);
  for (const provenance of Object.values(next.provenance ?? {})) if (provenance.source === 'photo-analysis') { provenance.sourcePhotoIds = []; provenance.evidenceState = 'deleted'; }
  return next;
};

export async function exportLibraryBackup(repository) {
  try {
    const state = await repository.readLibrary();
    if (!state.meta || !state.identities.length) return err({ kind: 'empty-library', message: 'There is no identity library to export.' });
    const document = {
      format: 'my-avatars-library-backup', version: 1, libraryId: state.meta.libraryId,
      exportedAt: state.meta.updatedAt, activeIdentity: sanitizeIdentity(state.identities.sort((a, b) => a.revision - b.revision).at(-1)),
      recipes: structuredClone(state.recipes), activeRecipeId: state.meta.activeRecipeId,
    };
    const json = canonicalJson(document);
    return ok({ document, json, bytes: new TextEncoder().encode(json) });
  } catch (error) { return err({ kind: 'backup-failed', message: error.message }); }
}

const parseBackup = (input) => {
  const value = typeof input === 'string' ? JSON.parse(input) : structuredClone(input);
  const keys = ['format', 'version', 'libraryId', 'exportedAt', 'activeIdentity', 'recipes', 'activeRecipeId'];
  if (!exact(value, keys) || value.format !== 'my-avatars-library-backup' || value.version !== 1 || typeof value.libraryId !== 'string' || !value.libraryId || typeof value.exportedAt !== 'string' || !Array.isArray(value.recipes) || !value.recipes.length || !value.recipes.some(({ id }) => id === value.activeRecipeId)) throw new TypeError('Invalid library backup.');
  validateIdentityProfileV1(value.activeIdentity);
  for (const recipe of value.recipes) validateAvatarRecipeV1(recipe);
  const ids = new Set(value.recipes.map(({ id }) => id));
  if (ids.size !== value.recipes.length) throw new TypeError('Backup recipe IDs must be unique.');
  if (value.recipes.some(({ identityRevision }) => identityRevision !== value.activeIdentity.revision)) throw new TypeError('Backup recipe identity revision is dangling.');
  canonicalJson(value);
  for (const provenance of Object.values(value.activeIdentity.provenance)) if (provenance.source === 'photo-analysis' && (provenance.sourcePhotoIds.length || provenance.evidenceState !== 'deleted')) throw new TypeError('Backup provenance is not sanitized.');
  return value;
};

export async function importLibraryBackup(repository, input, { confirmed = false } = {}) {
  let document;
  try { document = parseBackup(input); } catch (error) { return err({ kind: 'invalid-backup', message: error.message }); }
  const current = await repository.readLibrary();
  return repository.replaceFromBackup(document, {
    expectedBackupLibraryId: document.libraryId,
    expectedCurrentLibraryId: current.meta?.libraryId ?? null,
    confirmed,
  });
}

export async function restoreLibraryBackupAsNewPerson(repository, input, { confirmed = false, beforeCommit } = {}) {
  let document;
  try { document = parseBackup(input); } catch (error) { return err({ kind: 'invalid-backup', message: error.message }); }
  if (!confirmed) return err({ kind: 'confirmation-required', message: 'Confirm destructive restore as a new person and library.' });
  const current = await repository.readLibrary();
  return repository.restoreFromBackupAsNewPerson(document, {
    expectedCurrentLibraryId: current.meta?.libraryId ?? null,
    confirmed,
    beforeCommit,
  });
}
