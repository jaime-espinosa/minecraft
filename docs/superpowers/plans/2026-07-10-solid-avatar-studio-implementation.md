# Solid Avatar Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the upload-gated workbench with a mobile-first studio that starts with a polished playable avatar, saves recipes locally, installs as a PWA, and exports correct skins without network or WebGL.

**Architecture:** Extract versioned recipe state and Minecraft invariants into pure ES modules while retaining the current Canvas painter during migration. `app.js` becomes a UI coordinator; viewer initialization becomes optional and lazy.

**Tech Stack:** Browser ES modules, Canvas 2D, Three.js, IndexedDB, Service Worker, Node `node:test`.

---

### Task 1: Establish the pure-module test harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tests/recipe.test.js`
- Create: `src/avatar/recipe.js`

- [ ] **Step 1: Add the failing recipe tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRecipe, replaceIngredient } from '../src/avatar/recipe.js';

test('default recipe is complete and keeps hair on the hat layer', () => {
  const recipe = createDefaultRecipe();
  assert.deepEqual(Object.keys(recipe.ingredients).sort(),
    ['accessory','bottom','expression','face','hair','shoes','skin','top']);
  assert.equal(recipe.ingredients.hair.layer, 'hat');
  assert.equal(recipe.model, 'classic');
});

test('replacing one ingredient leaves the original recipe unchanged', () => {
  const original = createDefaultRecipe();
  const next = replaceIngredient(original, 'top', { color: '#8b3028' });
  assert.equal(original.ingredients.top.color, '#27394c');
  assert.equal(next.ingredients.top.color, '#8b3028');
  assert.equal(next.ingredients.face.style, original.ingredients.face.style);
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `npm test`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/avatar/recipe.js`.

- [ ] **Step 3: Add package metadata and the recipe module**

```json
{
  "name": "skin-forge",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/*.test.js" }
}
```

```js
const DEFAULT_RECIPE = {
  version: 1,
  model: 'classic',
  ingredients: {
    face: { style: 'warm-smile', eyeSpacing: 4 },
    hair: { style: 'full-curls', volume: 2, color: '#272019', layer: 'hat' },
    skin: { color: '#b96f4c' },
    expression: { style: 'smile' },
    top: { style: 'tee', color: '#27394c' },
    bottom: { style: 'pants', color: '#667249' },
    shoes: { style: 'low', color: '#272820' },
    accessory: { style: 'none' }
  }
};

export function createDefaultRecipe() { return structuredClone(DEFAULT_RECIPE); }

export function replaceIngredient(recipe, key, patch) {
  if (!Object.hasOwn(recipe.ingredients, key)) throw new TypeError(`Unknown ingredient: ${key}`);
  return { ...recipe, ingredients: { ...recipe.ingredients, [key]: { ...recipe.ingredients[key], ...patch } } };
}
```

Add `node_modules/`, `.superpowers/`, `face-comparison.html`, and local photo fixtures to `.gitignore`.

- [ ] **Step 4: Run `npm test` and confirm two passing tests**
- [ ] **Step 5: Commit with `test: add avatar recipe contract`**

### Task 2: Pin Minecraft export invariants

**Files:**
- Create: `src/minecraft/skin-validator.js`
- Create: `tests/skin-validator.test.js`
- Modify: `app.js:132-146`

- [ ] **Step 1: Test dimensions, alpha, required regions, and hat-layer hair**

```js
function paintOpaque(pixels, x, y, w, h) {
  for (let py=y; py<y+h; py+=1) for (let px=x; px<x+w; px+=1) pixels[(py*64+px)*4+3] = 255;
}

function completeSkin(model='classic') {
  const data = new Uint8ClampedArray(64 * 64 * 4);
  const armWidth = model === 'slim' ? 3 : 4;
  [[8,8,8,8],[20,20,8,12],[4,20,4,12],[20,52,4,12],[44,20,armWidth,12],[36,52,armWidth,12],[40,8,8,8]]
    .forEach((rect) => paintOpaque(data, ...rect));
  return { width:64, height:64, data };
}

test('rejects a skin without hat-layer hair', () => {
  const image = completeSkin();
  for (let y=8; y<16; y+=1) for (let x=40; x<48; x+=1) image.data[(y*64+x)*4+3] = 0;
  assert.equal(validateSkinPixels(image, 'classic').errors.includes('hat-layer-empty'), true);
});

test('rejects wrong dimensions and an empty independent limb', () => {
  assert.deepEqual(validateSkinPixels({ width:32, height:64, data:new Uint8ClampedArray() }).errors, ['dimensions']);
  const image = completeSkin();
  for (let y=52; y<64; y+=1) for (let x=36; x<40; x+=1) image.data[(y*64+x)*4+3] = 0;
  assert.equal(validateSkinPixels(image, 'classic').errors.includes('left-arm-empty'), true);
});

test('accepts complete Classic and Slim required regions', () => {
  assert.equal(validateSkinPixels(completeSkin('classic'), 'classic').valid, true);
  assert.equal(validateSkinPixels(completeSkin('slim'), 'slim').valid, true);
});
```

- [ ] **Step 2: Run `npm test`; expect missing validator failure**
- [ ] **Step 3: Implement `validateSkinPixels(imageData, model)` using explicit UV rectangles**

```js
const REQUIRED = {
  common: [[8,8,8,8,'head'],[20,20,8,12,'torso'],[4,20,4,12,'right-leg'],[20,52,4,12,'left-leg']],
  classic: [[44,20,4,12,'right-arm'],[36,52,4,12,'left-arm']],
  slim: [[44,20,3,12,'right-arm'],[36,52,3,12,'left-arm']]
};

function hasAlpha(data, x, y, w, h) {
  for (let py=y; py<y+h; py+=1) for (let px=x; px<x+w; px+=1)
    if (data[(py*64+px)*4+3] > 0) return true;
  return false;
}

export function validateSkinPixels(imageData, model='classic') {
  const errors=[];
  if (imageData.width!==64 || imageData.height!==64) return { valid:false, errors:['dimensions'] };
  for (const [x,y,w,h,name] of [...REQUIRED.common,...REQUIRED[model]]) if (!hasAlpha(imageData.data,x,y,w,h)) errors.push(`${name}-empty`);
  if (!hasAlpha(imageData.data,40,8,8,8)) errors.push('hat-layer-empty');
  return { valid:errors.length===0, errors };
}
```

- [ ] **Step 4: Call the validator before `updateDownload`; surface errors through `setStatus` and never offer an invalid download**
- [ ] **Step 5: Run tests; expect all validator cases to pass**
- [ ] **Step 6: Commit with `test: enforce minecraft skin invariants`**

### Task 3: Make the default avatar immediately renderable

**Files:**
- Modify: `app.js:1-174`
- Modify: `index.html:17-104`
- Modify: `styles.css:1-23`

- [ ] **Step 1: Add a browser smoke assertion that `#download-button` becomes available without selecting a file**
- [ ] **Step 2: Run the smoke script; expect failure because generation is upload-gated**
- [ ] **Step 3: Initialize `currentRecipe = createDefaultRecipe()`, map it into existing controls, call `generateSkin()` after DOM setup, and remove the disabled initial state from `#generate-button`**
- [ ] **Step 4: Replace the portrait-first hero with the approved Avatar Studio stage and ingredient grid while preserving `skin-canvas`, `skin-sheet-image`, `viewer`, `download-button`, and existing control IDs**
- [ ] **Step 5: Add `data-ingredient` buttons for Face, Hair, Skin, Top, Bottom, Shoes, Expression, Body, and Accessory; each opens a bottom sheet with presets and Keep Current**
- [ ] **Step 6: Apply the mobile layout at the existing `620px` breakpoint, use 44px minimum controls, and retain `prefers-reduced-motion`**
- [ ] **Step 7: Run the browser smoke; expect default preview and valid download before upload**
- [ ] **Step 8: Commit with `feat: add solid mobile avatar studio`**

### Task 4: Persist recipes without making storage mandatory

**Files:**
- Create: `src/storage/local-library.js`
- Create: `tests/local-library.test.js`
- Modify: `app.js`

- [ ] **Step 1: Test an injected in-memory adapter for `saveAvatar`, `listAvatars`, and `deleteAvatar`**
- [ ] **Step 2: Implement `LocalLibrary` with database `skin-forge`, schema version `1`, and stores `avatars`, `ingredients`, and `meta`**
- [ ] **Step 3: Add Save Character and My Skins controls; save versioned recipes and generated thumbnails, never source photos**
- [ ] **Step 4: Catch quota/open failures and switch to session-only state while preserving export**
- [ ] **Step 5: Run unit and browser tests; simulate an IndexedDB rejection and expect generation/download to remain available**
- [ ] **Step 6: Commit with `feat: save avatars locally`**

### Task 5: Decouple generation from Three.js

**Files:**
- Modify: `app.js`
- Modify: `viewer.js:41-92`
- Modify: `index.html:8-16`

- [ ] **Step 1: Add a smoke case that blocks `unpkg.com` and still downloads a PNG**
- [ ] **Step 2: Remove the static viewer import from the generation path; call `import('./viewer.js')` only after the result stage becomes visible**
- [ ] **Step 3: Return a no-op viewer adapter on import/WebGL failure and show `3D preview unavailable; your skin is still ready.`**
- [ ] **Step 4: Stop the render loop while the preview is hidden or `document.hidden`; restart on visibility**
- [ ] **Step 5: Run smoke cases with CDN and WebGL blocked**
- [ ] **Step 6: Commit with `fix: keep skin export independent of webgl`**

### Task 6: Add installable offline behavior

**Files:**
- Create: `manifest.webmanifest`
- Create: `sw.js`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `index.html`
- Modify: `app.js`

- [ ] **Step 1: Add manifest assertions for name, icons, `display: standalone`, theme color, and root-relative GitHub Pages scope**
- [ ] **Step 2: Cache only versioned same-origin Solid assets; do not cache telemetry responses or source images**
- [ ] **Step 3: Register the service worker after `load` and announce update availability without forced refresh**
- [ ] **Step 4: Verify offline reload, default generation, local library, and download after one online visit**
- [ ] **Step 5: Commit with `feat: make solid studio installable offline`**

### Task 7: Gate Solid deployment

**Files:**
- Create: `tests/browser/solid-smoke.mjs`
- Modify: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Automate default generation, Classic/Slim switching, outer-layer presence, exact 64x64 PNG dimensions, viewer failure, storage failure, and download**
- [ ] **Step 2: Run `npm test` and the browser proxy smoke locally; expect all checks to pass**
- [ ] **Step 3: Add a test job that must pass before the existing Pages deploy job**
- [ ] **Step 4: Commit with `ci: gate pages on solid avatar checks`**
