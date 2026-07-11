# Photo Fidelity Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine whether structured photo-derived ingredients beat polished defaults at Minecraft resolution before committing to the full ML capture pipeline.

**Architecture:** A private, local-only experiment separates feature extraction, deterministic rendering, blinded comparison, and runtime measurement. Personal photos and ratings are excluded from the repository and deployment.

**Tech Stack:** Browser Canvas, optional MediaPipe/ONNX Runtime Web spike, Node scripts, local HTML evaluation harness, browser proxy.

---

### Task 1: Create the private experiment contract

**Files:**
- Create: `experiments/fidelity/README.md`
- Create: `experiments/fidelity/manifest.example.json`
- Create: `experiments/fidelity/.gitignore`
- Create: `src/experimental/feature-schema.js`
- Create: `tests/feature-schema.test.js`

- [ ] **Step 1: Define feature records for face geometry, skin palette, hair silhouette/palette, outfit palette/pattern, source role, mask quality, and model version**
- [ ] **Step 2: Reject embedded image data, absolute source paths in exports, missing consent state, and unknown feature fields**
- [ ] **Step 3: Ignore `fixtures/`, `ratings/`, `renders/`, and any `PXL_*` files**
- [ ] **Step 4: Run tests and commit with `test: define private fidelity experiment`**

### Task 2: Build the baseline analyzer and renderer seam

**Files:**
- Create: `src/experimental/feature-analyzer.js`
- Create: `src/experimental/ingredient-renderer.js`
- Create: `tests/ingredient-renderer.test.js`

- [ ] **Step 1: Test fixed feature fixtures for eye spacing, brow weight, skin contrast, four hair silhouettes, clothing palette, and hat-layer placement**
- [ ] **Step 2: Implement analyzers behind `analyze(kind, imageData, mask) -> FeatureRecord`**
- [ ] **Step 3: Implement `renderIngredient(kind, features, recipe) -> PixelOperation[]`; make output deterministic for identical versioned inputs**
- [ ] **Step 4: Apply pixel operations through the existing compositor and validate the resulting PNG**
- [ ] **Step 5: Run tests and commit with `test: add deterministic fidelity renderer spike`**

### Task 3: Add smart focus only inside the experiment

**Files:**
- Create: `src/experimental/focus-mask.js`
- Create: `experiments/fidelity/focus-editor.html`
- Create: `experiments/fidelity/focus-editor.js`

- [ ] **Step 1: Implement a model adapter returning a bitmap mask plus confidence and model version**
- [ ] **Step 2: Add Add/Remove brush, undo, reset, pinch zoom, keyboard polygon selection, and Use Full Crop fallback**
- [ ] **Step 3: Keep all canvases local and assert no `fetch`, beacon, form submission, or telemetry access from the experiment**
- [ ] **Step 4: Measure model asset bytes, load time, inference time, peak memory estimate, and mask correction time**
- [ ] **Step 5: Commit with `test: prototype local smart focus`**

### Task 4: Build independent blinded comparison

**Files:**
- Create: `experiments/fidelity/compare.html`
- Create: `experiments/fidelity/compare.js`
- Create: `scripts/summarize-fidelity.mjs`

- [ ] **Step 1: Randomize left/right placement and hide whether each render is default or custom**
- [ ] **Step 2: Record forced choice, confidence, component judged, completion time, and anonymized case ID locally**
- [ ] **Step 3: Export ratings JSON without source photos or generated image bytes**
- [ ] **Step 4: Compute preference proportion, Wilson 95% interval, abandonment rate, per-component results, and device/runtime distribution**
- [ ] **Step 5: Fail the gate unless the preregistered preference threshold is above chance and the confidence interval clears 50 percent**
- [ ] **Step 6: Commit with `test: add blinded fidelity comparison`**

### Task 5: Run the gate and publish only the decision

**Files:**
- Create: `docs/experiments/photo-fidelity-gate.md`
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Run 15-20 representative private cases on iPhone 12 Safari and the selected mid-range Android Chrome device**
- [ ] **Step 2: Verify under-three-second model load/inference target, no network image transfer, accessible correction, and valid Classic/Slim exports**
- [ ] **Step 3: Record aggregate metrics, limitations, decision, and model asset hashes without personal data**
- [ ] **Step 4: If any required gate fails, keep photo-derived ingredients disabled and add the failure reason to the backlog**
- [ ] **Step 5: If every gate passes, write a separate promotion plan for production photo ingredients and capped Research Contribution**
- [ ] **Step 6: Commit with `docs: record photo fidelity gate`**
