import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PUBLIC_ROUTES, resolveRoute } from '../../src/routing/resolve-route.js';

test('resolves all five public routes without a notice', () => {
  assert.deepEqual(PUBLIC_ROUTES, [
    '#/studio',
    '#/library',
    '#/experimental/capture',
    '#/export/minecraft',
    '#/export/roblox-classic',
  ]);
  for (const route of PUBLIC_ROUTES) assert.deepEqual(resolveRoute(route), { route, redirectedFrom: null, notice: null });
});

test('applies only the three exact compatibility mappings', () => {
  assert.deepEqual(resolveRoute('#/solid'), { route: '#/studio', redirectedFrom: '#/solid', notice: 'Opened the dependable studio.' });
  assert.deepEqual(resolveRoute('#/solid/library'), { route: '#/library', redirectedFrom: '#/solid/library', notice: 'Opened your local library.' });
  assert.deepEqual(resolveRoute('#/experimental'), { route: '#/experimental/capture', redirectedFrom: '#/experimental', notice: 'Opened progressive capture.' });
});

test('empty and unknown hashes fall back accessibly without mutation', () => {
  for (const hash of ['', '#', '#/unknown', '#/solid/other']) {
    const result = resolveRoute(hash);
    assert.equal(result.route, '#/studio');
    assert.equal(result.redirectedFrom, hash || null);
    assert.match(result.notice, /studio/i);
    assert.equal(Object.isFrozen(result), true);
  }
});

test('dependable resolver has no experimental module import', async () => {
  const source = await readFile(new URL('../../src/routing/resolve-route.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import\s+.*experimental/i);
});
