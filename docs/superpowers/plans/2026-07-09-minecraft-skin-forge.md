# Minecraft Skin Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a GitHub Pages site that locally converts a portrait into a downloadable, modern Minecraft skin and previews it on a rotatable 3D player.

**Architecture:** A static HTML shell owns the accessible workflow. `app.js` normalizes the selected image and paints an RGBA 64x64 skin canvas; `viewer.js` maps that canvas to a Three.js cuboid player. No request leaves the browser.

**Tech Stack:** HTML5 Canvas, modern browser JavaScript modules, CSS, Three.js CDN module, GitHub Actions Pages deployment.

---

## File Structure

- `index.html`: app controls, status region, generated-skin canvas, and 3D preview container.
- `styles.css`: responsive editorial visual system and accessible interaction states.
- `app.js`: image validation, palette sampling, skin-template rendering, download, and UI state.
- `viewer.js`: block-player geometry, skin texture updates, drag rotation, and reset view.
- `.github/workflows/deploy-pages.yml`: deploy repository root as a static Pages artifact.

### Task 1: Build the static interface

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create semantic page and controls**

Create an upload panel with a labelled file input, a drop target, a thumbnail, arm-model radio buttons, auto-color toggle, five color inputs, hair and accessory selects, a Generate button, an aria-live status region, a 64x64 output canvas, a `#viewer` region, Download, Reset, and Reset View buttons. Link `styles.css` and load `app.js` with `type="module"`.

- [ ] **Step 2: Style the responsive Skin Forge workspace**

Define CSS custom properties for paper, ink, copper, moss, and sky. Build a two-column desktop workspace that becomes one column below 900px. Include keyboard focus, disabled, drag-over, loading, generated-result, and reduced-motion states. Use display typography distinct from the browser default and retain readable native controls.

### Task 2: Implement local skin generation

**Files:**
- Create: `app.js`

- [ ] **Step 1: Wire image input and validation**

Accept image files only, reject missing/undecodable files with a status message, display the selected image through an object URL, and enable the Generate button only after image decoding.

- [ ] **Step 2: Normalize image and derive colors**

Draw the source image centered and cover-cropped into a 32x32 offscreen canvas. Sample fixed facial/hair/clothing regions, use median RGB values to avoid outliers, and expose those colors through the manual controls when auto color is enabled.

- [ ] **Step 3: Paint a valid 64x64 Minecraft skin canvas**

Use a transparent 64x64 Canvas. Paint head, torso, arms, legs, hat, and clothing overlays within the modern skin template UV rectangles. Apply palette shading by darkening side and bottom surfaces. Render a face from a reduced portrait sample with eyes, hair, optional beard, and glasses. Use narrower arm faces when the slim model is selected.

- [ ] **Step 4: Export and reset**

Convert the output canvas to a PNG Blob, connect it to a download link with the filename `minecraft-skin.png`, and release prior object URLs when regenerating or resetting. Reset clears the selected image, restores defaults, clears the output canvas, and resets the 3D texture.

### Task 3: Build the interactive 3D preview

**Files:**
- Create: `viewer.js`

- [ ] **Step 1: Initialize lightweight Three.js scene**

Import a pinned Three.js module from `unpkg.com`, create a perspective camera, renderer, ambient/key lights, neutral floor plane, and `OrbitControls` configured for rotation only. Resize via `ResizeObserver`.

- [ ] **Step 2: Create a Minecraft player mesh**

Build grouped box geometries for head, torso, two arms, and two legs. Create a CanvasTexture from the generator canvas and provide per-face material groups that map each box to its corresponding skin region. Create optional outer-layer boxes for hat and clothing overlays. Rebuild arm geometry when classic/slim selection changes.

- [ ] **Step 3: Expose the preview API**

Export `createSkinViewer(container, skinCanvas)` returning `{ updateSkin, setSlim, resetView, dispose }`. `updateSkin` marks the CanvasTexture dirty; `setSlim` swaps arms; `resetView` sets the default rotation and camera position.

### Task 4: Connect generation to preview and polish states

**Files:**
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Step 1: Connect the viewer**

Create the viewer on startup. After every successful generation, call `viewer.setSlim(selectedModel === 'slim')` followed by `viewer.updateSkin()`. Wire Reset View to the viewer and announce successful generation in the live region.

- [ ] **Step 2: Add clear processing feedback**

Show a brief `Forging your skin...` status while work occurs, prevent duplicate clicks, and reveal the output/download controls only after a PNG is generated. State plainly that processing is local and source images are not uploaded.

### Task 5: Configure GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Add static Pages workflow**

Configure `workflow_dispatch` and pushes to `main`, set `pages: write` and `id-token: write` permissions, upload the repository root using `actions/upload-pages-artifact`, and deploy using `actions/deploy-pages`.

- [ ] **Step 2: Document deployment in the page footer**

Include a source/repository placeholder link only if the repository URL is known at implementation time; otherwise omit it rather than publishing an invalid destination. GitHub Pages setup requires choosing `GitHub Actions` as the Pages source in repository settings.
