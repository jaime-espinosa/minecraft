# Minecraft Skin Forge Design

## Goal

Build a free, static website that turns a user-provided portrait into a
downloadable Minecraft-compatible skin PNG, with a live 3D character preview.
The first release must run entirely in the browser and deploy to GitHub Pages.

## Scope

The site accepts a local image through drag-and-drop or a file picker. It
creates a stylized skin using deterministic browser-side image processing:
cropping, palette extraction, pixelation, and compositing onto a modern
Minecraft `64 x 64` skin template. No image, API key, or generated output is
sent to a server.

The converter makes a best-effort front-facing character from the visible
image. It does not claim to infer unseen details or to provide generative AI.

## User Experience

The page is a single Skin Forge workspace with these stages:

1. Image input: an accessible drop zone and file picker accept common image
   formats and show the selected portrait.
2. Character settings: controls provide useful choices without requiring the
   user to understand the skin layout.
3. Generation: a short visible processing state creates a skin preview.
4. Results: the user sees the PNG template and an interactive 3D model, then
   downloads the final file as `minecraft-skin.png`.

The settings are:

- `Classic` or `Slim` arms.
- Auto-detected colors or manual skin, hair, shirt, pants, and shoe colors.
- Hair style, beard, glasses, and outer-layer clothing accent toggles.
- Reset and regenerate actions.

## Skin Generator

The generator uses Canvas APIs only.

1. Draw the input to an internal canvas, crop it to a centered square, and
   reduce it to a small pixel grid.
2. Sample colors from stable regions of the crop to derive a palette. Manual
   choices override sampled colors.
3. Create a transparent `64 x 64` canvas using the documented modern
   Minecraft skin regions: head, torso, arms, legs, plus transparent outer
   layers.
4. Paint small blocks of sampled and selected colors into the relevant UV
   regions. Face details use the centered crop as a visual guide; clothing and
   back/side surfaces use the selected palette and deliberate shading.
5. Export a lossless PNG through `canvas.toBlob`.

Output is a `64 x 64` RGBA PNG compatible with the modern Java skin format and
with current Bedrock import flows. Slim arms use the narrow arm regions; the
classic setting uses the normal-width arm regions.

## 3D Preview

Use the Three.js ES module from a pinned CDN version. A small scene contains a
camera, lights, floor shadow, and a block-model character. Each cuboid uses
the generated skin canvas as a texture mapped to the matching Minecraft UV
regions. Drag rotates the character; a reset-view button restores the default
pose. The preview updates from the same generated canvas used for download.

## Architecture

The static application consists of:

- `index.html`: semantic page structure and controls.
- `styles.css`: responsive visual system, layout, and loading/result states.
- `app.js`: validation, image normalization, palette logic, skin canvas
  rendering, export, and UI state.
- `viewer.js`: Three.js character construction, texture update, and view
  controls.
- `.github/workflows/deploy-pages.yml`: GitHub Pages static deployment.

There is no backend, database, account system, or telemetry. The browser never
uploads the source image.

## Errors and Accessibility

Reject unsupported files, empty files, and images that cannot be decoded with
plain-language inline messages. Disable generation until an image is selected.
Use native labels, keyboard-operable controls, visible focus states, sufficient
contrast, and respect reduced-motion preferences. The layout supports narrow
mobile screens and wide desktops.

## Future AI Boundary

A future optional server-side endpoint may replace the deterministic palette
and face-guidance stage with an image-generation pipeline. That endpoint must
live outside GitHub Pages, keep provider credentials server-side, rate-limit
requests, and return only a final skin PNG. The initial UI and renderer remain
unchanged.

## Testing Boundary

Manual acceptance checks after implementation will cover image selection,
classic and slim outputs, PNG dimensions/transparency, download, 3D texture
update, keyboard operation, and mobile layout. Automated testing is out of
scope for the static first release.
