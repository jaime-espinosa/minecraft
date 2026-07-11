const clone = (value) => structuredClone(value);
const failed = (value) => value?.ok === false;
const latestIdentity = (document) => [...document.identities]
  .sort((left, right) => left.revision - right.revision)
  .at(-1);

export function createDurableLibraryAdapter({ repository, libraryDocument }) {
  let recipes = clone(libraryDocument.recipes);
  let activeId = libraryDocument.meta.activeRecipeId;
  let photos = clone(libraryDocument.photos.map((item) => item.metadata ?? item));
  let migrating = false;

  const activeRecipe = () => clone(recipes.find(({ id }) => id === activeId));
  const refreshedFrame = async () => {
    const document = await repository.readLibrary();
    return {
      identity: latestIdentity(document),
      recipe: activeRecipe(),
    };
  };

  return Object.freeze({
    list() { return clone(recipes); },
    active: activeRecipe,
    listPhotos() { return clone(photos); },
    getNormalizedPhoto(id) { return repository.getNormalizedPhoto(id); },
    async nextRecipeId() { return repository.reserveNextRecipeId(); },
    async storeNormalizedPhoto(envelope) {
      const result = await repository.storeNormalizedPhoto(envelope);
      if (failed(result)) return result;
      photos.push(clone(envelope.metadata));
      return result;
    },
    hasMigration() { return migrating; },
    async save(recipe) {
      const existing = recipes.find(({ id }) => id === recipe.id);
      const result = await repository.saveRecipe(recipe, { baseRevision: existing?.revision ?? 0 });
      if (failed(result)) return result;
      const index = recipes.findIndex(({ id }) => id === recipe.id);
      if (index < 0) recipes.push(clone(recipe));
      else recipes[index] = clone(recipe);
      activeId = recipe.id;
      return result;
    },
    async select(id) {
      if (!recipes.some((recipe) => recipe.id === id)) return false;
      const result = await repository.selectRecipe(id);
      if (failed(result)) return result;
      activeId = id;
      return true;
    },
    async delete(id) {
      if (recipes.length <= 1 || !recipes.some((recipe) => recipe.id === id)) return false;
      const result = await repository.deleteLook(id);
      if (failed(result)) return result;
      recipes = recipes.filter((recipe) => recipe.id !== id);
      if (activeId === id) activeId = recipes[0].id;
      return true;
    },
    async reset(frame) {
      migrating = true;
      try {
        const result = await repository.replaceLibraryWithFrame(frame);
        if (failed(result)) return result;
        recipes = [clone(frame.recipe)];
        activeId = frame.recipe.id;
        photos = [];
        return frame.recipe;
      } finally {
        migrating = false;
      }
    },
    async deletePhoto(id) {
      const result = await repository.deletePhoto(id);
      if (failed(result)) return result;
      photos = photos.filter((photo) => photo.id !== id);
      return { ok: true, value: await refreshedFrame() };
    },
    async deleteAllPhotos() {
      const result = await repository.deleteAllPhotos();
      if (failed(result)) return result;
      photos = [];
      return { ok: true, value: await refreshedFrame() };
    },
    async deleteUnusedPhotos(usedIds) {
      const result = await repository.deleteUnusedPhotos(usedIds);
      if (failed(result)) return result;
      const deleted = new Set(result.value);
      photos = photos.filter(({ id }) => !deleted.has(id));
      return { ok: true, value: await refreshedFrame() };
    },
    async saveIdentityFrame(frame, { baseRevision }) {
      const result = await repository.saveIdentity(frame.identity, { baseRevision });
      if (failed(result)) return result;
      const document = await repository.readLibrary();
      recipes = clone(document.recipes);
      activeId = document.meta.activeRecipeId;
      const active = activeRecipe();
      const currentRecipe = clone(frame.recipe);
      currentRecipe.revision = active.revision;
      currentRecipe.identityRevision = frame.identity.revision;
      return {
        ok: true,
        value: {
          identity: clone(frame.identity),
          recipe: currentRecipe,
        },
      };
    },
  });
}
