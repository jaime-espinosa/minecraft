# Historical Skin Forge Project Handoff

> Historical evidence only. This handoff describes the retired Minecraft-only prototype and is superseded by `docs/FINAL_SOLUTION.md` and the My Avatars cross-game foundation design.

Last updated: 2026-07-10 (America/Los_Angeles)

## Current Production State

- Live site: https://jaime-espinosa.github.io/minecraft/
- GitHub repository: https://github.com/jaime-espinosa/minecraft
- Deployed `main`: `ded8b5299eb8216ae1b141199a561c8ae36ae27f`
- Latest commit: `feat: add portrait fidelity controls`
- Latest Pages workflow: successful, run `29063895244`
- Hosting: GitHub Pages through `.github/workflows/deploy-pages.yml`

The product is a static, browser-only Minecraft skin generator. A user uploads a portrait, adjusts a face crop and character settings, generates a modern `64 x 64` RGBA skin PNG, inspects it on a rotatable Three.js player, and downloads it. Source images remain in the browser; there is no backend, account, database, or paid inference service.

## Source Layout

- `index.html`: upload UI, face-crop controls, character settings, result canvas, fidelity score, download link, and 3D preview container.
- `styles.css`: responsive visual design, mobile breakpoints, pixel-sheet presentation, and large bottom preview stage.
- `app.js`: image decoding, crop state, optional browser face detection, palette sampling, UV painting, face/hair templates, PNG export, score calculation, and UI state.
- `viewer.js`: Three.js base and outer-layer player meshes, Classic/Slim UV maps, texture updates, rotation controls, resize handling, and resource disposal.
- `AGENTS.md`: contributor instructions and repository conventions.
- `docs/superpowers/specs/2026-07-09-minecraft-skin-forge-design.md`: original approved design.
- `docs/superpowers/plans/`: implementation and fidelity-loop plans.

## Current User Experience

After upload, users can adjust horizontal/vertical face position and zoom. Character controls include:

- Classic or Slim arms.
- Automatic palette extraction or manual skin, hair, shirt, pants, and shoe colors.
- Hair style: Curly volume, Cropped, Side sweep, or Long.
- Curl volume: Subtle, Full, or Big silhouette.
- Expression: Neutral, Soft smile, or Open smile.
- Accessories: None, Glasses, Beard, or Jacket layer.

The current default is a soft smile with full curly hair. Hair is painted on the Minecraft hat/outer-head layer, not directly onto the base face. The 3D preview renders the hat, jacket, sleeve, and pants outer layers and uses separate UV coordinates for Slim arms.

## Generation Pipeline

1. Decode a local image into an `Image` object.
2. Attempt Chromium `FaceDetector` centering; otherwise use the manual crop defaults.
3. Draw the selected crop into a `32 x 32` temporary canvas.
4. Sample median colors for skin and hair from the crop.
5. Sample shirt, pants, and shoes from fixed bands in a center-square copy of the whole image.
6. Paint base head, torso, both arms, and both legs into official modern skin UV regions.
7. Paint duplicate outer clothing regions.
8. Paint structured brows, eyes, nose, selected expression, and shirt/neck boundary on the base face.
9. Paint an adaptive dark-pixel mask plus a selected curl silhouette on the hat layer.
10. Export the same canvas used by the 3D viewer as a lossless PNG Blob.

## Face Fidelity Reference and Evidence

The current reference face intentionally emphasizes:

- Wide dark curly hair silhouette on the hat layer.
- Warm medium skin.
- Strong dark brows.
- Two dark eyes.
- Small nose shading.
- Soft/asymmetric dark smile.
- Dark shirt/neck boundary.

Browser-proxy observations using
`C:\Users\jaime\Downloads\PXL_20250821_204203007~2 (1).jpg` produced:

- First local score: `0.9327`.
- Repeat local score: `0.9327`.
- Improvement: `0.0000`, which triggered the `< 0.02` asymptote stop rule.
- Live GitHub Pages score: `0.9327`.

Important: this score compares generated pixels with a palette-dependent reference created by the same renderer. It is useful for regression detection, but it is not an independent perceptual-similarity score. The side-by-side comparison showed a much larger human-visible gap than `0.9327` suggests. Do not claim person-level fidelity from this number.

## Browser Automation

The project uses `/home/jaime/src/_util/_browse` instead of adding a separate browser stack.

Start it with:

```bash
PYTHONPATH=/home/jaime/src python3 -m _util._browse.mcp_server --http --port 8767
```

Local, uncommitted `_browse` extensions were added during this work:

- `browser_act` action `upload`, implemented with Playwright `page.set_input_files()`.
- `browser_extract` type `canvas`, returning `canvas.toDataURL("image/png")`.

These extensions enabled the real upload -> generate -> extract-score/canvas loop. They live in `/home/jaime/src/_util/_browse/mcp_server.py` and are not part of the Minecraft deployment. Preserve or formalize them before depending on the automation in CI.

## Local Reference Artifacts

These are intentionally not part of the deployed site unless explicitly promoted:

- `face-comparison.html`: standalone comparison page with the original portrait embedded. It contains personal image data and should not be pushed publicly without explicit approval.
- `mark-minecraft-skin.png`: hand-authored, importable `64 x 64` example skin using the hat layer for hair.
- Generated design reference: `/home/jaime/.codex/generated_images/019f4844-6061-70f1-ab07-87dc6c6b5dc9/exec-591185bb-0f1e-48df-922f-d989969764de.png`.
- Reference photos: `/mnt/c/Users/jaime/Downloads/PXL_2*`.
- The clearest observed references included front-facing portraits, close facial views, full-body dark-shirt views, and multiple angles showing the curl silhouette.
- `package.json` was created locally while probing Playwright; its default `npm test` is not a useful test and it has not been part of the published workflow.

## Known Gaps and Risks

1. Subject isolation is not implemented. Clothing colors still come from fixed bands of a center-square image and can be polluted by background objects.
2. `FaceDetector` is not portable across all target browsers. Firefox and Safari rely on manual crop controls.
3. Face geometry is template-based rather than landmark-driven. It does not yet infer actual eye spacing, brow shape, mouth shape, or head pose.
4. Hair mapping uses thresholded crop pixels plus a template; it is not true hair segmentation.
5. The fidelity score is self-referential and overly generous.
6. Three.js and fonts load from third-party CDNs. A CDN/WebGL startup failure can still prevent all module initialization, including upload handlers.
7. The Three.js render loop runs continuously, including when the preview is hidden.
8. There is no committed executable regression suite or deploy gate.
9. Multi-photo input, guided mobile capture, Roblox export, and a PWA install experience are design directions only; none is implemented.
10. A true Roblox layered-clothing avatar requires meshes/cages and Roblox Studio. A practical first Roblox target would be Classic shirt/pants/face templates.

## Product Decisions

- Keep Minecraft v1 free, private, and browser-only.
- Prefer a mobile-first PWA before building native iOS/Android apps.
- Replace arbitrary gallery uploads with a guided capture sequence: front neutral, front smile, left/right 45-degree angles, full-body front/back, optional hair/outfit close-ups.
- For multiple photos, assign roles: face reference, hair reference, and outfit reference.
- Use the hat layer for hair in every generation and every comparison.
- Keep manual controls because automated detection will sometimes be wrong.
- Treat Roblox Classic as a separate export mode that can reuse shared face/hair/outfit analysis.

## Recommended Next Work

1. Add multi-photo input with explicit Face, Hair, and Outfit roles.
2. Build guided mobile capture with blur, lighting, framing, and coverage checks.
3. Add a browser-local landmark/segmentation model, likely MediaPipe, for face geometry, subject isolation, and hair masks.
4. Replace the current score with a fixed, independently authored target plus landmark, silhouette, palette, and contrast components. Validate it against human side-by-side judgments.
5. Commit browser automation into the repository and gate Pages deployment on upload, generation, Classic/Slim, PNG-region completeness, and download tests.
6. Make the 2D generator work when Three.js, WebGL, or the CDN is unavailable; lazy-load the preview.
7. Add Roblox Classic templates only after the shared multi-photo analysis pipeline is reliable.

## Development and Publishing

Serve locally:

```bash
python3 -m http.server 8000
```

This workspace's `.git` directory is read-only and not a usable checkout. Publishing has been performed from `/tmp/minecraft-skin-forge-publish`, a clone of `https://github.com/jaime-espinosa/minecraft.git`. Copy only intended project files into that clone, stage explicit paths, commit with a Conventional Commit message, and push `main`. If the temporary clone is absent, recreate it rather than trying to initialize this workspace.

## Context Message for a Fresh Session

```text
Continue Skin Forge in /home/jaime/kids/minecraft. Read AGENTS.md and docs/HANDOFF.md first. The live site is https://jaime-espinosa.github.io/minecraft/ and repository is https://github.com/jaime-espinosa/minecraft. Production main is ded8b5299eb8216ae1b141199a561c8ae36ae27f (feat: add portrait fidelity controls), with a successful Pages deployment.

The app is static HTML/CSS/JS. app.js locally processes portrait uploads into a modern 64x64 Minecraft skin; viewer.js renders base and outer layers in Three.js. Hair must always use the hat layer. Current settings include crop position/zoom, Classic/Slim arms, automatic/manual colors, hair style, curl volume, expression, and accessories.

The current 0.9327 face score is self-referential and does not represent perceptual identity similarity. A visual comparison showed that the site output still differs substantially from the person and the hand-authored reference. The main technical gaps are subject isolation, portable face landmarks, real hair segmentation, multi-photo consensus, and an independent fidelity metric.

Use /home/jaime/src/_util/_browse for browser observation. Local uncommitted extensions add browser_act action=upload and browser_extract extract_type=canvas in _util/_browse/mcp_server.py. Reference photos are under /mnt/c/Users/jaime/Downloads/PXL_2*. Local privacy-sensitive artifacts include face-comparison.html; do not publish it without explicit approval. mark-minecraft-skin.png is a hand-authored playable example, and the generated design reference is /home/jaime/.codex/generated_images/019f4844-6061-70f1-ab07-87dc6c6b5dc9/exec-591185bb-0f1e-48df-922f-d989969764de.png.

Recommended next milestone: guided multi-photo mobile/PWA capture with Face/Hair/Outfit roles, then browser-local landmarks and segmentation, followed by a fixed independently authored similarity score and a committed browser automation deploy gate. Use codebase-memory-mcp for discovery. Do not treat the current score as proof of likeness.
```
# Authoritative Documentation Notice (2026-07-10)

The complete decision record now starts at `docs/README.md`. `docs/FINAL_SOLUTION.md` is authoritative when this historical handoff conflicts with later decisions. The approved target is the Mode-Isolated Modular Workbench: separate Solid and Experimental route modules sharing only a validated `AvatarFrame`; deterministic exact RGBA export; optional lazy Three.js; hair enforced on the hat layer; a same-origin password-gated Cloudflare Worker Workshop; and privacy-gated telemetry that remains disabled until all child-safety controls pass. Production remains the earlier static prototype at `ded8b5299eb8216ae1b141199a561c8ae36ae27f`; the final architecture is documented and planned but not implemented or deployed.
