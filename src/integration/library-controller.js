export function createLibraryController({ document, session, confirm = globalThis.confirm }) {
  const looks = document.querySelector('#library-looks');
  const photos = document.querySelector('#library-photos');
  const render = (model) => {
    looks.replaceChildren(...model.recipes.map((recipe) => {
      const row = document.createElement('p');
      row.dataset.recipeId = recipe.id;
      row.textContent = recipe.localLabel;
      const select = document.createElement('button');
      select.type = 'button'; select.textContent = 'Select'; select.dataset.action = 'select-look';
      select.addEventListener('click', () => session.dispatch({ type: 'select-look', id: recipe.id }));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = 'Delete look'; remove.dataset.action = 'delete-look';
      remove.disabled = model.recipes.length <= 1;
      remove.addEventListener('click', () => { if (confirm('Delete this saved look?')) session.dispatch({ type: 'delete-look', id: recipe.id }); });
      row.append(' ', select, ' ', remove);
      return row;
    }));
    photos.replaceChildren(...model.library.photos.map((photo) => {
      const row = document.createElement('p');
      row.dataset.photoId = photo.id;
      row.textContent = `${photo.role} · ${photo.width} × ${photo.height}`;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = 'Delete photo'; remove.dataset.action = 'delete-photo';
      remove.addEventListener('click', () => { if (confirm('Delete this local source photo?')) session.dispatch({ type: 'delete-photo', id: photo.id }); });
      row.append(' ', remove);
      return row;
    }));
  };
  const unsubscribe = session.subscribe(render);
  const deleteAll = () => { if (confirm('Delete all local source photos?')) session.dispatch({ type: 'delete-all-photos' }); };
  document.querySelector('#delete-all-photos').addEventListener('click', deleteAll);
  return Object.freeze({ dispose() { unsubscribe(); document.querySelector('#delete-all-photos').removeEventListener('click', deleteAll); } });
}
