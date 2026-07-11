import { createDefaultIdentity, createDefaultRecipe } from '../domain/defaults.js';
import { canonicalJson } from '../domain/canonical-json.js';
import { validateAvatarOperation, validateAvatarRecipeV1, validateIdentityProfileV1, validateSourcePhotoV1 } from '../domain/contracts.js';
import { err, ok } from '../domain/result.js';
import { DB_NAME, STORE_NAMES, openDatabase, requestResult, runTransaction } from './database.js';

const clone = (value) => structuredClone(value);
const all = (store) => requestResult(store.getAll());
const metaRecord = (libraryId, now, activeRecipeId = 'avatar-1') => ({ key: 'library', schemaVersion: 1, libraryId, createdAt: now, updatedAt: now, activeRecipeId });
const sanitizeProvenance = (identity, deletedIds = null) => {
  const next = clone(identity);
  for (const value of Object.values(next.provenance ?? {})) {
    if (value.source !== 'photo-analysis') continue;
    if (deletedIds === null || value.sourcePhotoIds.some((id) => deletedIds.has(id))) {
      value.sourcePhotoIds = []; value.evidenceState = 'deleted';
    }
  }
  return next;
};

const assertClosedDataObject = (value, keys, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object.`);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) throw new TypeError(`${path} has an unknown key.`);
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`${path}.${key} must be enumerable data.`);
  }
};

const validateNormalizedPhotoEnvelope = (envelope) => {
  assertClosedDataObject(envelope, ['metadata', 'blob'], '$');
  validateSourcePhotoV1(envelope.metadata);
  const metadata = envelope.metadata;
  if (!metadata.id || !metadata.blobKey || !metadata.normalizationVersion) throw new TypeError('Photo identifiers and normalization version must be nonempty.');
  if (metadata.width > 2048 || metadata.height > 2048) throw new TypeError('Photo dimensions must not exceed 2048.');
  if (new Date(metadata.createdAt).toISOString() !== metadata.createdAt) throw new TypeError('Photo createdAt must be canonical ISO time.');
  if (Object.prototype.toString.call(envelope.blob) !== '[object Blob]' || Reflect.ownKeys(envelope.blob).some((key) => typeof key === 'string') || envelope.blob.size <= 0 || envelope.blob.type !== metadata.mimeType) throw new TypeError('Photo Blob type and size must match normalized metadata.');
  return envelope;
};

const assertClosedArray = (value, path) => {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array.`);
  const allowed = new Set(['length', ...Array.from({ length: value.length }, (_, index) => String(index))]);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) throw new TypeError(`${path} is decorated.`);
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`${path}[${key}] must be enumerable data.`);
  }
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index)) throw new TypeError(`${path} must be dense.`);
};
const nonemptyString = (value, path) => { if (typeof value !== 'string' || !value) throw new TypeError(`${path} must be a nonempty string.`); };
const canonicalTime = (value, path) => { nonemptyString(value, path); if (new Date(value).toISOString() !== value) throw new TypeError(`${path} must be canonical ISO time.`); };
const validateDraft = (draft) => {
  assertClosedDataObject(draft, ['id', 'recipeId', 'sourcePhotoIds', 'baseRecipeRevision', 'operations', 'createdAt'], '$');
  nonemptyString(draft.id, '$.id'); nonemptyString(draft.recipeId, '$.recipeId'); canonicalTime(draft.createdAt, '$.createdAt');
  if (!Number.isInteger(draft.baseRecipeRevision) || draft.baseRecipeRevision < 0) throw new TypeError('$.baseRecipeRevision must be a nonnegative integer.');
  assertClosedArray(draft.sourcePhotoIds, '$.sourcePhotoIds'); draft.sourcePhotoIds.forEach((id, index) => nonemptyString(id, `$.sourcePhotoIds[${index}]`));
  assertClosedArray(draft.operations, '$.operations'); draft.operations.forEach((operation, index) => validateAvatarOperation(operation, `$.operations[${index}]`));
  if (new Set(draft.sourcePhotoIds).size !== draft.sourcePhotoIds.length) throw new TypeError('$.sourcePhotoIds must not contain duplicates.');
  const evidenceIds = [...new Set(draft.operations.flatMap((operation) => operation.provenance?.sourcePhotoIds ?? []))].sort();
  const declaredIds = [...draft.sourcePhotoIds].sort();
  if (evidenceIds.length !== declaredIds.length || evidenceIds.some((id, index) => id !== declaredIds[index])) throw new TypeError('$.sourcePhotoIds must exactly match operation provenance.');
};
const validateArtifactRecord = (artifact) => {
  assertClosedDataObject(artifact, ['id', 'recipeId', 'sourcePhotoIds', 'compiler', 'sourceDigest', 'createdAt'], '$');
  nonemptyString(artifact.id, '$.id'); nonemptyString(artifact.recipeId, '$.recipeId'); canonicalTime(artifact.createdAt, '$.createdAt');
  assertClosedArray(artifact.sourcePhotoIds, '$.sourcePhotoIds'); artifact.sourcePhotoIds.forEach((id, index) => nonemptyString(id, `$.sourcePhotoIds[${index}]`));
  if (!['minecraft-v1', 'roblox-classic-v1'].includes(artifact.compiler)) throw new TypeError('$.compiler is unsupported.');
  if (typeof artifact.sourceDigest !== 'string' || !/^[0-9a-f]{64}$/.test(artifact.sourceDigest)) throw new TypeError('$.sourceDigest must be lowercase SHA-256.');
};

export async function openIdentityLibrary({ indexedDB, databaseName = DB_NAME, storageEstimate = async () => ({}), clock = () => new Date().toISOString(), createId = () => crypto.randomUUID(), beforeWrite = () => {} } = {}) {
  const opened = await openDatabase({ indexedDB, name: databaseName });
  if (!opened.ok) return opened;
  const db = opened.value;
  const initialize = await runTransaction(db, ['meta', 'identities', 'recipes'], 'readwrite', async (tx) => {
    const meta = tx.objectStore('meta');
    if (await requestResult(meta.get('library'))) return;
    const now = clock(), libraryId = createId();
    meta.put(metaRecord(libraryId, now));
    tx.objectStore('identities').put(clone(createDefaultIdentity()));
    tx.objectStore('recipes').put(clone(createDefaultRecipe()));
  });
  if (!initialize.ok) { db.close(); return initialize; }

  const repository = {
    db,
    async readLibrary() {
      const tx = db.transaction(STORE_NAMES, 'readonly');
      const values = await Promise.all(STORE_NAMES.map((name) => name === 'meta' ? requestResult(tx.objectStore(name).get('library')) : all(tx.objectStore(name))));
      return Object.fromEntries(STORE_NAMES.map((name, index) => [name, name === 'meta' ? values[index] ?? null : values[index]]));
    },
    async getNormalizedPhoto(id) {
      if (typeof id !== 'string' || !id) return err({ kind: 'invalid-photo-id', message: 'A local photo ID is required.' });
      try {
        const transaction = db.transaction(['photos'], 'readonly');
        const value = await requestResult(transaction.objectStore('photos').get(id));
        return value
          ? ok({ metadata: clone(value.metadata), blob: value.blob })
          : err({ kind: 'photo-not-found', message: 'That local source photo was not found.' });
      } catch (error) {
        return err({ kind: error?.kind ?? 'storage-failed', message: error?.message || 'Local photo retrieval failed.' });
      }
    },
    async saveIdentity(identity, { baseRevision } = {}) {
      try { validateIdentityProfileV1(identity); } catch (error) { return err({ kind: 'invalid-record', message: error.message }); }
      return runTransaction(db, ['identities', 'recipes', 'meta'], 'readwrite', async (tx) => {
        const identities = tx.objectStore('identities'); const records = await all(identities); const current = records.sort((a, b) => a.revision - b.revision).at(-1);
        if ((current?.revision ?? 0) !== baseRevision || identity.revision !== baseRevision + 1) throw Object.assign(new Error('Identity revision conflict.'), { kind: 'revision-conflict' });
        const recipeStore = tx.objectStore('recipes');
        const rebasedRecipes = (await all(recipeStore)).map((recipe) => ({ ...clone(recipe), revision: recipe.revision + 1, identityRevision: identity.revision }));
        try { for (const recipe of rebasedRecipes) validateAvatarRecipeV1(recipe); } catch (error) { throw Object.assign(new Error(error.message), { kind: 'invalid-record' }); }
        identities.put(clone(identity));
        for (const recipe of rebasedRecipes) recipeStore.put(recipe);
        const meta = await requestResult(tx.objectStore('meta').get('library')); meta.updatedAt = clock(); tx.objectStore('meta').put(meta);
        return identity;
      });
    },
    async saveRecipe(recipe, { baseRevision } = {}) {
      try { validateAvatarRecipeV1(recipe); } catch (error) { return err({ kind: 'invalid-record', message: error.message }); }
      return runTransaction(db, ['recipes', 'identities', 'meta'], 'readwrite', async (tx) => {
        const recipes = tx.objectStore('recipes'); const current = await requestResult(recipes.get(recipe.id));
        if ((current?.revision ?? 0) !== baseRevision || recipe.revision !== baseRevision + 1) throw Object.assign(new Error('Recipe revision conflict.'), { kind: 'revision-conflict' });
        const identities = await all(tx.objectStore('identities')); const activeIdentity = identities.sort((a, b) => a.revision - b.revision).at(-1);
        if (!activeIdentity || recipe.identityRevision !== activeIdentity.revision) throw Object.assign(new Error('Recipe identity revision is not active.'), { kind: 'identity-revision-conflict' });
        recipes.put(clone(recipe)); const meta = await requestResult(tx.objectStore('meta').get('library')); meta.activeRecipeId = recipe.id; meta.updatedAt = clock(); tx.objectStore('meta').put(meta); return recipe;
      });
    },
    async selectRecipe(id) {
      return runTransaction(db, ['recipes', 'meta'], 'readwrite', async (tx) => {
        if (!await requestResult(tx.objectStore('recipes').get(id))) throw Object.assign(new Error('Recipe not found.'), { kind: 'look-not-found' });
        const meta = await requestResult(tx.objectStore('meta').get('library')); meta.activeRecipeId = id; meta.updatedAt = clock(); tx.objectStore('meta').put(meta); return id;
      });
    },
    async reserveNextRecipeId() {
      return runTransaction(db, ['recipes', 'meta'], 'readwrite', async (tx) => {
        const records = await all(tx.objectStore('recipes'));
        const metaStore = tx.objectStore('meta');
        const meta = await requestResult(metaStore.get('library'));
        const retainedMaximum = Math.max(
          1,
          ...records.map(({ id }) => Number(/^avatar-(\d+)$/.exec(id)?.[1] ?? 0)),
        );
        const next = Math.max(meta.maxRecipeSequence ?? 1, retainedMaximum) + 1;
        meta.maxRecipeSequence = next;
        meta.updatedAt = clock();
        metaStore.put(meta);
        return `avatar-${next}`;
      });
    },
    async storeNormalizedPhoto(envelope) {
      try { validateNormalizedPhotoEnvelope(envelope); } catch (error) { return err({ kind: 'invalid-photo', message: error.message }); }
      try {
        const estimate = await storageEstimate();
        const required = envelope.blob.size;
        if (Number.isFinite(estimate.quota) && (estimate.usage ?? 0) + required > estimate.quota) return err({ kind: 'quota-exceeded', message: 'Not enough local storage.' });
      } catch {}
      return runTransaction(db, ['photos'], 'readwrite', (tx) => {
        const stored = { metadata: clone(envelope.metadata), blob: envelope.blob };
        tx.objectStore('photos').put(stored, envelope.metadata.id);
        beforeWrite({ operation: 'store-normalized-photo', transaction: tx });
        return stored;
      });
    },
    putDraft(draft) {
      try { validateDraft(draft); } catch (error) { return Promise.resolve(err({ kind: 'invalid-draft', message: error.message })); }
      return runTransaction(db, ['drafts'], 'readwrite', (tx) => { tx.objectStore('drafts').put(clone(draft)); return draft; });
    },
    putArtifact(artifact) {
      try { validateArtifactRecord(artifact); } catch (error) { return Promise.resolve(err({ kind: 'invalid-artifact', message: error.message })); }
      return runTransaction(db, ['artifacts'], 'readwrite', (tx) => { tx.objectStore('artifacts').put(clone(artifact)); return artifact; });
    },
    async deletePhoto(id) {
      return runTransaction(db, ['photos', 'identities', 'drafts', 'artifacts'], 'readwrite', async (tx) => {
        tx.objectStore('photos').delete(id);
        const identities = await all(tx.objectStore('identities'));
        for (const identity of identities) tx.objectStore('identities').put(sanitizeProvenance(identity, new Set([id])));
        for (const storeName of ['drafts', 'artifacts']) for (const record of await all(tx.objectStore(storeName))) if (record.sourcePhotoIds.includes(id)) tx.objectStore(storeName).delete(record.id);
      });
    },
    async deleteAllPhotos() {
      return runTransaction(db, ['photos', 'identities', 'drafts', 'artifacts'], 'readwrite', async (tx) => {
        tx.objectStore('photos').clear(); tx.objectStore('drafts').clear(); tx.objectStore('artifacts').clear();
        for (const identity of await all(tx.objectStore('identities'))) tx.objectStore('identities').put(sanitizeProvenance(identity));
      });
    },
    async deleteUnusedPhotos(usedIds) {
      if (!(usedIds instanceof Set) || [...usedIds].some((id) => typeof id !== 'string' || !id)) return err({ kind: 'invalid-photo-ids', message: 'Used local photo IDs are invalid.' });
      return runTransaction(db, ['photos', 'identities', 'drafts', 'artifacts'], 'readwrite', async (tx) => {
        const photos = tx.objectStore('photos');
        const deletedIds = new Set();
        for (const record of await all(photos)) {
          if (!usedIds.has(record.metadata.id)) {
            photos.delete(record.metadata.id);
            deletedIds.add(record.metadata.id);
          }
        }
        for (const storeName of ['drafts', 'artifacts']) {
          const store = tx.objectStore(storeName);
          for (const record of await all(store)) if (record.sourcePhotoIds.some((id) => deletedIds.has(id))) store.delete(record.id);
        }
        const identities = tx.objectStore('identities');
        for (const identity of await all(identities)) identities.put(sanitizeProvenance(identity, deletedIds));
        return [...deletedIds];
      });
    },
    async deleteLook(id) {
      return runTransaction(db, ['recipes', 'drafts', 'artifacts', 'meta'], 'readwrite', async (tx) => {
        const recipes = tx.objectStore('recipes'); const records = await all(recipes);
        if (!records.some((recipe) => recipe.id === id) || records.length <= 1) throw new DOMException('Look deletion rejected.', 'ConstraintError');
        recipes.delete(id); const meta = await requestResult(tx.objectStore('meta').get('library')); if (meta.activeRecipeId === id) meta.activeRecipeId = records.find((recipe) => recipe.id !== id).id; tx.objectStore('meta').put(meta);
        for (const storeName of ['drafts', 'artifacts']) for (const record of await all(tx.objectStore(storeName))) if (record.recipeId === id) tx.objectStore(storeName).delete(record.id);
      });
    },
    async deleteLibrary({ confirmed } = {}) {
      if (!confirmed) return err({ kind: 'confirmation-required', message: 'Confirm library deletion.' });
      return runTransaction(db, STORE_NAMES, 'readwrite', (tx) => { for (const name of STORE_NAMES) tx.objectStore(name).clear(); });
    },
    async resetForNewPerson({ confirmed, beforeCommit } = {}) {
      if (!confirmed) return err({ kind: 'confirmation-required', message: 'Confirm person reset.' });
      return runTransaction(db, STORE_NAMES, 'readwrite', async (tx) => {
        for (const name of STORE_NAMES) tx.objectStore(name).clear();
        tx.objectStore('meta').put(metaRecord(createId(), clock(), null));
        beforeCommit?.();
      });
    },
    async replaceLibraryWithFrame(frame) {
      try { validateIdentityProfileV1(frame.identity); validateAvatarRecipeV1(frame.recipe); } catch (error) { return err({ kind: 'invalid-record', message: error.message }); }
      return runTransaction(db, STORE_NAMES, 'readwrite', (tx) => {
        for (const name of STORE_NAMES) tx.objectStore(name).clear();
        const now=clock();tx.objectStore('meta').put(metaRecord(createId(),now,frame.recipe.id));tx.objectStore('identities').put(clone(frame.identity));tx.objectStore('recipes').put(clone(frame.recipe));return frame;
      });
    },
    async replaceFromBackup(document, { expectedBackupLibraryId, expectedCurrentLibraryId, confirmed = false } = {}) {
      try {
        validateIdentityProfileV1(document.activeIdentity);
        if (!Array.isArray(document.recipes) || !document.recipes.length) throw new TypeError('Backup recipes are required.');
        for (const recipe of document.recipes) validateAvatarRecipeV1(recipe);
        const ids = new Set(document.recipes.map(({ id }) => id));
        if (ids.size !== document.recipes.length || !ids.has(document.activeRecipeId)) throw new TypeError('Backup recipe IDs are invalid.');
        if (document.recipes.some(({ identityRevision }) => identityRevision !== document.activeIdentity.revision)) throw new TypeError('Backup recipe identity revision is dangling.');
      } catch (error) { return err({ kind: 'invalid-backup', message: error.message }); }
      return runTransaction(db, STORE_NAMES, 'readwrite', async (tx) => {
        if (expectedBackupLibraryId !== document.libraryId) throw Object.assign(new Error('Backup authorization changed.'), { kind: 'backup-changed' });
        const currentMeta = await requestResult(tx.objectStore('meta').get('library'));
        const storeRecords = await Promise.all(STORE_NAMES.filter((name) => name !== 'meta').map((name) => all(tx.objectStore(name))));
        const empty = !currentMeta && storeRecords.every((records) => records.length === 0);
        if ((currentMeta?.libraryId ?? null) !== expectedCurrentLibraryId) throw Object.assign(new Error('The local library changed before replacement.'), { kind: 'library-changed' });
        if (!empty && currentMeta.libraryId !== document.libraryId) throw Object.assign(new Error('This backup belongs to another local library.'), { kind: 'foreign-library' });
        if (!empty && !confirmed) throw Object.assign(new Error('Confirm replacement of this local library.'), { kind: 'confirmation-required' });
        for (const name of STORE_NAMES) tx.objectStore(name).clear();
        tx.objectStore('meta').put({ key: 'library', schemaVersion: 1, libraryId: document.libraryId, createdAt: document.exportedAt, updatedAt: clock(), activeRecipeId: document.activeRecipeId });
        tx.objectStore('identities').put(clone(document.activeIdentity));
        for (const recipe of document.recipes) tx.objectStore('recipes').put(clone(recipe));
      });
    },
    async restoreFromBackupAsNewPerson(document, { expectedCurrentLibraryId, confirmed = false, beforeCommit } = {}) {
      if (!confirmed) return err({ kind: 'confirmation-required', message: 'Confirm destructive restore as a new person and library.' });
      try {
        validateIdentityProfileV1(document.activeIdentity);
        if (!Array.isArray(document.recipes) || !document.recipes.length) throw new TypeError('Backup recipes are required.');
        for (const recipe of document.recipes) validateAvatarRecipeV1(recipe);
        const ids = new Set(document.recipes.map(({ id }) => id));
        if (ids.size !== document.recipes.length || !ids.has(document.activeRecipeId)) throw new TypeError('Backup recipe IDs are invalid.');
        if (document.recipes.some(({ identityRevision }) => identityRevision !== document.activeIdentity.revision)) throw new TypeError('Backup recipe identity revision is dangling.');
      } catch (error) { return err({ kind: 'invalid-backup', message: error.message }); }
      return runTransaction(db, STORE_NAMES, 'readwrite', async (tx) => {
        const [metaRecords, identities, recipes, photos, drafts, artifacts] = await Promise.all([
          all(tx.objectStore('meta')),
          all(tx.objectStore('identities')),
          all(tx.objectStore('recipes')),
          all(tx.objectStore('photos')),
          all(tx.objectStore('drafts')),
          all(tx.objectStore('artifacts')),
        ]);
        const currentMeta = metaRecords.find(({ key }) => key === 'library') ?? null;
        if ((currentMeta?.libraryId ?? null) !== expectedCurrentLibraryId) throw Object.assign(new Error('The local library changed before disaster recovery.'), { kind: 'library-changed' });
        const pristine = metaRecords.length === 1
          && identities.length === 1
          && recipes.length === 1
          && photos.length === 0
          && drafts.length === 0
          && artifacts.length === 0
          && canonicalJson(identities[0]) === canonicalJson(createDefaultIdentity())
          && canonicalJson(recipes[0]) === canonicalJson(createDefaultRecipe());
        if (!pristine) throw Object.assign(new Error('Disaster recovery requires a fresh local library.'), { kind: 'restore-not-pristine' });
        for (const name of STORE_NAMES) tx.objectStore(name).clear();
        tx.objectStore('meta').put({ key: 'library', schemaVersion: 1, libraryId: document.libraryId, createdAt: document.exportedAt, updatedAt: clock(), activeRecipeId: document.activeRecipeId });
        tx.objectStore('identities').put(clone(document.activeIdentity));
        for (const recipe of document.recipes) tx.objectStore('recipes').put(clone(recipe));
        beforeCommit?.();
      });
    },
  };
  return ok(Object.freeze(repository));
}
