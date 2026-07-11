const clone = (value) => structuredClone(value);

export function createMemoryLibrary(initialRecipe) {
  const recipes = [clone(initialRecipe)];
  let activeId = initialRecipe.id;
  return Object.freeze({
    list() { return clone(recipes); },
    active() { return clone(recipes.find(({ id }) => id === activeId)); },
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
    reset(recipe) { recipes.splice(0, recipes.length, clone(recipe)); activeId = recipe.id; return clone(recipe); },
  });
}
