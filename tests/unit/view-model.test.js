import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createStudioViewModel } from '../../src/studio-session/view-model.js';
import { DEFAULT_PRESENTATION_CONFIG, resolvePresentationConfig } from '../../src/presentation/config.js';
import { choiceIntent, getRoutePresentation, moveChoice, orderNavigationItems } from '../../src/presentation/shell.js';

const forbiddenKeys = (value, found = []) => {
  if (!value || typeof value !== 'object') return found;
  for (const [key, nested] of Object.entries(value)) {
    if (/blob|digest|photoBytes|pixelDigest|sourceDigest/i.test(key)) found.push(key);
    forbiddenKeys(nested, found);
  }
  return found;
};

test('StudioViewModelV1 has the exact deeply frozen privacy-safe shape', () => {
  const frame = createAvatarKernel().start().value;
  const model = createStudioViewModel({ frame, recipes: [frame.recipe], route: '#/studio' });
  assert.deepEqual(Object.keys(model), [
    'route', 'navigation', 'identityRevision', 'activeRecipe', 'recipes', 'editor',
    'proposal', 'previews', 'exports', 'library', 'busy', 'fault', 'announcement',
  ]);
  assert.equal(model.navigation.length, 5);
  assert.equal(model.identityRevision, 1);
  assert.deepEqual(forbiddenKeys(model), []);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.editor.hair), true);
  assert.throws(() => { model.editor.hair.style = 'long'; }, TypeError);
});

test('presentation config accepts only safe v1 variants and falls back immutably', () => {
  const valid = structuredClone(DEFAULT_PRESENTATION_CONFIG);
  valid.layoutVariant = 'stage-right';
  assert.equal(resolvePresentationConfig(valid).layoutVariant, 'stage-right');
  for (const invalid of [
    { ...valid, schemaVersion: 2 },
    { ...valid, layoutVariant: 'runtime-html' },
    { ...valid, unknown: true },
    { ...valid, features: { ...valid.features, privacy: false } },
    { ...valid, features: { ...valid.features, deletion: false } },
    { ...valid, features: { ...valid.features, validation: false } },
    { ...valid, features: { ...valid.features, exports: false } },
    { ...valid, features: { ...valid.features, accessibility: false } },
  ]) assert.equal(resolvePresentationConfig(invalid), DEFAULT_PRESENTATION_CONFIG);
  assert.equal(Object.isFrozen(DEFAULT_PRESENTATION_CONFIG.tokens), true);
});

test('choice helpers never unselect and share one bounded Continue intent', () => {
  assert.deepEqual(choiceIntent({ value: 'slim', current: 'classic', gesture: 'click' }), { selected: 'slim', continue: false });
  assert.deepEqual(choiceIntent({ value: 'slim', current: 'slim', gesture: 'click' }), { selected: 'slim', continue: false });
  assert.deepEqual(choiceIntent({ value: 'slim', current: 'classic', gesture: 'double' }), { selected: 'slim', continue: true });
  assert.deepEqual(choiceIntent({ value: 'slim', current: 'classic', gesture: 'double-tap' }), { selected: 'slim', continue: true });
  assert.deepEqual(choiceIntent({ value: 'slim', current: 'classic', key: ' ' }), { selected: 'slim', continue: false });
  assert.deepEqual(choiceIntent({ value: 'slim', current: 'slim', key: 'Enter' }), { selected: 'slim', continue: true });
  assert.equal(moveChoice(['classic', 'slim'], 'classic', 'ArrowRight'), 'slim');
  assert.equal(moveChoice(['classic', 'slim'], 'classic', 'ArrowLeft'), 'slim');
  assert.equal(choiceIntent({ value: 'slim', current: 'classic', gesture: 'double-tap', pointerType: 'mouse' }).continue, false);
  assert.equal(choiceIntent({ value: 'slim', current: 'classic', gesture: 'double', pointerType: 'touch' }).continue, false);
});

test('route presentation covers all five dependable views', () => {
  const headings = new Set();
  for (const route of ['#/studio', '#/library', '#/experimental/capture', '#/export/minecraft', '#/export/roblox-classic']) {
    const view = getRoutePresentation(route);
    assert.equal(view.route, route);
    assert.ok(view.heading.length > 0);
    assert.ok(view.content.length > 0);
    headings.add(view.heading);
  }
  assert.equal(headings.size, 5);
});

test('navigation ordering moves all route nodes in configured group order while preserving peers', () => {
  const items = [
    { id: 'studio', dataset: { navGroup: 'build' } },
    { id: 'library', dataset: { navGroup: 'library' } },
    { id: 'capture', dataset: { navGroup: 'build' } },
    { id: 'minecraft', dataset: { navGroup: 'export' } },
    { id: 'roblox', dataset: { navGroup: 'export' } },
  ];
  assert.deepEqual(
    orderNavigationItems(items, ['export', 'build', 'library']).map(({ id }) => id),
    ['minecraft', 'roblox', 'studio', 'capture', 'library'],
  );
  assert.deepEqual(items.map(({ id }) => id), ['studio', 'library', 'capture', 'minecraft', 'roblox']);
});

test('checked-in schema is closed and presentation wiring consumes config', async () => {
  const schema = JSON.parse(await readFile(new URL('../../presentation-config.schema.v1.json', import.meta.url)));
  assert.equal(schema.additionalProperties, false);
  for (const nested of ['tokens', 'labels', 'features']) assert.equal(schema.properties[nested].additionalProperties, false);
  const shell = await readFile(new URL('../../src/presentation/shell.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  const appController = await readFile(new URL('../../src/integration/app-controller.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../styles.css', import.meta.url), 'utf8');
  assert.match(shell, /aria-current/);
  assert.match(shell, /layoutVariant/);
  assert.match(shell, /config\.labels/);
  assert.match(app, /--surface/);
  assert.match(html, /for="classic"/);
  assert.match(html, /for="slim"/);
  assert.equal((html.match(/data-nav-group=/g) ?? []).length, 5);
  assert.match(shell, /model\.previews\.minecraft\.url/);
  assert.match(shell, /removeAttribute\(['"]src['"]\)/);
  assert.match(shell, /removeAttribute\(['"]href['"]\)/);
  assert.match(shell, /avatar-silhouette/);
  assert.match(appController, /pagehide[\s\S]*persisted/);
  assert.match(appController, /pageshow[\s\S]*persisted/);
  assert.match(app, /createObjectURL\(bytes,\s*mediaType\)/);
  assert.match(css, /input:focus-visible\s*\+\s*span/);
  assert.match(css, /layout-stage-right \.export-panel\s*\{\s*order:3/);
  assert.doesNotMatch(shell, /style\.order/);
  assert.match(shell, /nav\.append\(/);
  assert.match(css, /\[aria-current=['"]page['"]\][^{]*\{[^}]*font-weight/);
  assert.match(css, /(?:\[aria-current=['"]page['"]\]|\.is-current)::after\s*\{[^}]*content:\s*['"]Current['"]/);
  assert.doesNotMatch(shell, /session\.dispatch\(\{ type: 'navigate'/);
  assert.match(appController, /hashchange[\s\S]*handleRoute/);
});
