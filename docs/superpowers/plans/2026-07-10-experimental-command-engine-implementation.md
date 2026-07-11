# Experimental Command Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Solid/Experimental toggle and a deterministic instruction box that safely changes avatar recipes and constrained Workshop configuration.

**Architecture:** A pure parser emits a closed set of JSON operations. Separate reducers apply avatar and design operations; neither parser nor remote configuration can execute code or mutate Solid state.

**Tech Stack:** ES modules, Node `node:test`, browser DOM and ARIA live regions.

---

### Task 1: Define the operation boundary

**Files:**
- Create: `src/instructions/operations.js`
- Create: `tests/operations.test.js`

- [ ] **Step 1: Test accepted and rejected operation shapes**

```js
assert.equal(validateOperation({ type:'avatar.setColor', ingredient:'top', value:'#112233' }).ok, true);
assert.equal(validateOperation({ type:'eval', value:'alert(1)' }).ok, false);
assert.equal(validateOperation({ type:'design.setToken', token:'previewHeight', value:520 }).ok, true);
assert.equal(validateOperation({ type:'design.setToken', token:'backgroundImage', value:'url(x)' }).ok, false);
```

- [ ] **Step 2: Implement an allowlist for `avatar.setColor`, `avatar.setStyle`, `avatar.setModel`, `design.setToken`, `design.moveComponent`, `design.setVisible`, `history.undo`, `history.restore`, and `workshop.publish`**
- [ ] **Step 3: Constrain colors to hex, preview height to 320-720, component IDs to the declared studio list, and versions to positive integers**
- [ ] **Step 4: Run tests and commit with `test: define experimental operation schema`**

### Task 2: Parse useful local commands

**Files:**
- Create: `src/instructions/parser.js`
- Create: `tests/parser.test.js`

- [ ] **Step 1: Add table-driven tests for hair length/volume, named shirt colors, expression, Classic/Slim, preview height, component move/show/hide, undo, restore, and publish**
- [ ] **Step 2: Add explicit rejection tests for URLs, script tags, shell verbs, repository commands, and requests outside character/UI design**
- [ ] **Step 3: Implement ordered rules returning `{ status, operations, ignored, message }`; never use `eval`, `Function`, HTML parsing, or dynamic imports**

```js
const COLORS = { red:'#9b342d', blue:'#27394c', green:'#4f6746', black:'#272820', white:'#eee9dc' };
const RULES = [
  { match:/\b(classic|slim)\b/i, build:m=>({type:'avatar.setModel', value:m[1].toLowerCase()}) },
  { match:/\b(red|blue|green|black|white)\b.*\b(shirt|top)\b/i, build:m=>({type:'avatar.setColor', ingredient:'top', value:COLORS[m[1].toLowerCase()]}) },
  { match:/\bpreview\b.*\b(\d{3})\b/i, build:m=>({type:'design.setToken', token:'previewHeight', value:Number(m[1])}) }
];
```

- [ ] **Step 4: Run tests and commit with `feat: parse local avatar instructions`**

### Task 3: Apply operations with undoable state

**Files:**
- Create: `src/instructions/reducer.js`
- Create: `tests/reducer.test.js`
- Modify: `app.js`

- [ ] **Step 1: Test that invalid operations are atomic, undo restores the prior recipe, and Solid state never reads design operations**
- [ ] **Step 2: Implement `applyOperations(state, operations)` returning a new state with capped 20-entry history**
- [ ] **Step 3: Regenerate the exact composer canvas after avatar operations; apply design tokens only to an Experimental CSS custom-property map**
- [ ] **Step 4: Run tests and commit with `feat: apply undoable experimental commands`**

### Task 4: Add the two-mode interface

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] **Step 1: Add a top `role="radiogroup"` Solid/Experimental toggle and keep Solid selected by default**
- [ ] **Step 2: Add the Experimental instruction form directly below it with disclosure text, command history, and `aria-live="polite"` outcome**
- [ ] **Step 3: Preserve the current recipe while switching modes; reset only Experimental design tokens when returning to Solid**
- [ ] **Step 4: Disable remote controls when the backend is unavailable while leaving local commands active**
- [ ] **Step 5: Browser-test keyboard, touch, reduced motion, mode preservation, unsupported requests, and injection-shaped text**
- [ ] **Step 6: Commit with `feat: add experimental instruction mode`**

### Task 5: Add the remote configuration adapter behind a default-off flag

**Files:**
- Create: `src/experimental/config-client.js`
- Create: `tests/config-client.test.js`
- Modify: `app.js`

- [ ] **Step 1: Test schema rejection, last-known-good retention, ETag handling, preview/public scope, and rollback events**
- [ ] **Step 2: Fetch `/api/config/public` only in Experimental; authenticated Workshop sessions additionally fetch `/api/config/preview`**
- [ ] **Step 3: Apply only validated operations through the reducer; never inject server strings as HTML or CSS text**
- [ ] **Step 4: Commit with `feat: consume versioned experimental config`**

