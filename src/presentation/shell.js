export function choiceIntent({ value, current, gesture, key, pointerType }) {
  const selected = value ?? current;
  const mouseDouble = gesture === 'double' && pointerType !== 'touch';
  const touchDouble = gesture === 'double-tap' && pointerType !== 'mouse';
  return Object.freeze({ selected, continue: mouseDouble || touchDouble || key === 'Enter' });
}

export function moveChoice(values, current, key) {
  const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : key === 'ArrowRight' || key === 'ArrowDown' ? 1 : 0;
  if (!direction) return current;
  const index = values.indexOf(current);
  return values[(index + direction + values.length) % values.length];
}

const ROUTE_PRESENTATION = Object.freeze({
  '#/studio': { heading: 'One avatar. Many worlds.', content: 'Build a polished look without supplying a photo.' },
  '#/library': { heading: 'Your local library', content: 'Keep many saved looks for one person on this device.' },
  '#/experimental/capture': { heading: 'Progressive capture', content: 'The isolated capture module is ready to load when the next milestone is installed.' },
  '#/export/minecraft': { heading: 'Minecraft export', content: 'Validate and download an exact modern 64 × 64 PNG.' },
  '#/export/roblox-classic': { heading: 'Roblox Classic export', content: 'Prepare local shirt and pants candidates with clear platform limitations.' },
});

export function getRoutePresentation(route) {
  const selected = ROUTE_PRESENTATION[route] ?? ROUTE_PRESENTATION['#/studio'];
  return Object.freeze({ route: Object.hasOwn(ROUTE_PRESENTATION, route) ? route : '#/studio', ...selected });
}

export function orderNavigationItems(items, order) {
  return [...items].sort((left, right) => order.indexOf(left.dataset.navGroup) - order.indexOf(right.dataset.navGroup));
}

const manualPalette = (primary) => {
  const channels = primary.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16));
  const hex = (values) => `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  return {
    primary,
    shadow: hex(channels.map((value) => Math.max(0, Math.min(255, Math.round(value * .72))))),
    highlight: hex(channels.map((value) => Math.max(0, Math.min(255, Math.round(value + (255 - value) * .18))))),
  };
};

export function renderStudioShell(root, session, config) {
  root.body?.classList.add(`layout-${config.layoutVariant}`);
  root.querySelector('.brand').textContent = config.labels.brand;
  const nav = root.querySelector('nav[aria-label="Primary"]');
  nav.append(...orderNavigationItems(nav.querySelectorAll('[data-route]'), config.order));
  const sections = [...root.querySelectorAll('[data-section]')];
  sections.forEach((element) => {
    if (config.labels[element.dataset.section]) element.textContent = config.labels[element.dataset.section];
  });
  const controls = {
    expression: root.querySelector('#expression'), hairStyle: root.querySelector('#hair-style'),
    model: [...root.querySelectorAll('input[name="model"]')], status: root.querySelector('#status'),
  };
  const manualControls = new Map([
    ['complexion', root.querySelector('#manual-complexion')],
    ['hair', root.querySelector('#manual-hair')],
    ['top', root.querySelector('#manual-top')],
    ['bottom', root.querySelector('#manual-bottom')],
    ['footwear', root.querySelector('#manual-footwear')],
  ]);
  const render = (model) => {
    controls.status.textContent = model.announcement;
    controls.expression.value = model.editor.face.expression;
    controls.hairStyle.value = model.editor.hair.style;
    controls.model.forEach((input) => { input.checked = input.value === model.editor.platformProfiles.minecraft.geometry; });
    manualControls.get('complexion').value = model.editor.complexionPalette.primary;
    manualControls.get('hair').value = model.editor.hair.palette.primary;
    for (const field of ['top', 'bottom', 'footwear']) manualControls.get(field).value = model.editor.outfit[field].primary;
    root.querySelector('#active-look-label').textContent = model.activeRecipe.localLabel;
    const routeView = getRoutePresentation(model.route);
    root.querySelector('#page-title').textContent = routeView.heading;
    root.querySelector('#route-view-content').textContent = routeView.content;
    root.querySelectorAll('[data-route]').forEach((link) => {
      const current = link.dataset.route === model.route;
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.classList.toggle('is-current', current);
    });
    const download = root.querySelector('#download-button');
    const image = root.querySelector('#minecraft-texture-image');
    if (model.previews.minecraft.url) {
      download.hidden = false;
      download.href = model.previews.minecraft.url;
      image.src = model.previews.minecraft.url;
      image.hidden = false;
      root.querySelector('.avatar-silhouette').hidden = true;
    } else {
      download.hidden = true;
      download.removeAttribute('href');
      image.removeAttribute('src');
      image.hidden = true;
      root.querySelector('.avatar-silhouette').hidden = false;
    }
  };
  controls.expression.addEventListener('change', () => session.dispatch({ type: 'edit', baseRevision: session.getViewModel().activeRecipe.revision, operations: [{ op: 'set-expression', value: controls.expression.value }] }));
  controls.hairStyle.addEventListener('change', () => session.dispatch({ type: 'edit', baseRevision: session.getViewModel().activeRecipe.revision, operations: [{ op: 'set-hair', value: { style: controls.hairStyle.value, volume: session.getViewModel().editor.hair.volume } }] }));
  for (const [field, input] of manualControls) input.addEventListener('change', () => {
    const model = session.getViewModel();
    session.dispatch({
      type: 'edit',
      baseRevision: model.activeRecipe.revision,
      operations: [{
        op: 'set-palette',
        field,
        value: manualPalette(input.value),
        provenance: { source: 'manual', sourcePhotoIds: [], evidenceState: 'not-applicable' },
      }],
    });
  });
  root.querySelector('#generate-button').addEventListener('click', () => session.dispatch({ type: 'compile-minecraft' }));
  root.querySelector('#save-look').addEventListener('click', () => session.dispatch({ type: 'save-look' }));
  root.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', () => { location.hash = link.dataset.route.slice(1); }));
  controls.model.forEach((input) => input.addEventListener('change', () => {
    const model = session.getViewModel();
    const seed = { ...model.editor.platformProfiles.minecraft, geometry: input.value };
    session.dispatch({ type: 'edit', baseRevision: model.activeRecipe.revision, minecraftProfile: seed });
  }));
  const continueAction = () => root.querySelector('#generate-button').click();
  controls.model.forEach((input) => {
    const card = root.querySelector(`label[for="${input.id}"]`);
    let pointerType = 'mouse';
    card.addEventListener('pointerdown', (event) => { pointerType = event.pointerType || 'mouse'; });
    card.addEventListener('dblclick', () => { if (pointerType !== 'touch') continueAction(); });
    input.addEventListener('keydown', (event) => {
      const values = controls.model.map(({ value }) => value);
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        const next = moveChoice(values, input.value, event.key);
        const target = controls.model.find(({ value }) => value === next);
        target.checked = true;
        target.dispatchEvent(new Event('change'));
        target.focus();
      }
      if (event.key === 'Enter') { event.preventDefault(); continueAction(); }
    });
    card.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'touch') return;
      const now = Date.now();
      if (now - Number(input.dataset.lastTap || 0) < 450) continueAction();
      input.dataset.lastTap = String(now);
    });
  });
  const resetDialog = root.querySelector('#reset-person-dialog');
  root.querySelector('#request-reset-person').addEventListener('click', () => resetDialog.showModal());
  root.querySelector('#cancel-reset-person').addEventListener('click', () => resetDialog.close());
  root.querySelector('#confirm-reset-person').addEventListener('click', async () => { const result = await session.dispatch({ type: 'confirm-reset-person' }); if (result.ok) resetDialog.close(); });
  return session.subscribe(render);
}
