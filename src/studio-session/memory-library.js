const clone = (value) => structuredClone(value);

export function createMemoryLibrary(initialRecipe) {
  const recipes = [clone(initialRecipe)];
  let photos = [];
  const photoEnvelopes = new Map();
  let activeId = initialRecipe.id;
  let maxRecipeSequence = Number(/^avatar-(\d+)$/.exec(initialRecipe.id)?.[1] ?? 1);
  return Object.freeze({
    list() { return clone(recipes); },
    active() { return clone(recipes.find(({ id }) => id === activeId)); },
    listPhotos() { return clone(photos); },
    async getNormalizedPhoto(id) {
      const envelope = photoEnvelopes.get(id);
      return envelope
        ? { ok: true, value: { metadata: clone(envelope.metadata), blob: envelope.blob } }
        : { ok: false, fault: { kind: 'photo-not-found', message: 'That local source photo was not found.' } };
    },
    nextRecipeId() { maxRecipeSequence += 1; return { ok: true, value: `avatar-${maxRecipeSequence}` }; },
    async storeNormalizedPhoto(envelope) { photoEnvelopes.set(envelope.metadata.id, envelope); photos.push(clone(envelope.metadata)); return { ok: true, value: envelope }; },
    saveIdentityFrame(frame) { const index=recipes.findIndex(({id})=>id===frame.recipe.id);if(index>=0)recipes[index]=clone(frame.recipe);return {ok:true,value:clone(frame)}; },
    save(recipe) { recipes.push(clone(recipe)); activeId = recipe.id; return clone(recipe); },
    select(id) { if (!recipes.some((recipe) => recipe.id === id)) return false; activeId = id; return true; },
    delete(id) {
      if (recipes.length === 1) return false;
      const index = recipes.findIndex((recipe) => recipe.id === id);
      if (index < 0) return false;
      recipes.splice(index, 1);
      if (activeId === id) activeId = recipes[0].id;
      return true;
    },
    hasMigration() { return false; },
    deletePhoto(id) { photos=photos.filter((photo)=>photo.id!==id);photoEnvelopes.delete(id);return {ok:true}; },
    deleteAllPhotos() { photos=[];photoEnvelopes.clear();return {ok:true}; },
    deleteUnusedPhotos(usedIds) {
      const deleted = photos.filter(({ id }) => !usedIds.has(id)).map(({ id }) => id);
      photos = photos.filter(({ id }) => usedIds.has(id));
      deleted.forEach((id) => photoEnvelopes.delete(id));
      return { ok: true };
    },
    reset(value) { const recipe=value.recipe??value;recipes.splice(0, recipes.length, clone(recipe));activeId=recipe.id;photos=[];photoEnvelopes.clear();maxRecipeSequence=Number(/^avatar-(\d+)$/.exec(recipe.id)?.[1]??1);return clone(recipe); },
    dispose() { photos=[];photoEnvelopes.clear(); },
  });
}
