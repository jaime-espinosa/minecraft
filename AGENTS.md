# Repository Guidelines

## Project Structure & Module Organization

This is a static GitHub Pages application. Keep the root intentionally small:

- `index.html` contains the accessible Skin Forge interface and control IDs.
- `styles.css` owns the responsive visual system and layout.
- `app.js` handles image input, local Canvas skin generation, PNG download, and UI state.
- `viewer.js` renders the interactive Three.js player preview.
- `.github/workflows/deploy-pages.yml` deploys `main` to GitHub Pages.
- `docs/superpowers/` contains approved designs and implementation plans.

Keep generated screenshots, downloaded skins, and face-fidelity reports out of the source tree unless a task explicitly requires checked-in fixtures.

## Build, Test, and Development Commands

No compilation step is required. Serve the repository root locally:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser. GitHub Pages deploys automatically after a push to `main`.

For browser-driven observation, use the shared browser proxy rather than adding another browser stack:

```bash
PYTHONPATH=/home/jaime/src python3 -m _util._browse.mcp_server --http --port 8767
```

## Coding Style & Naming Conventions

Use modern browser JavaScript with `const`/`let`, semicolons, and two-space indentation. Prefer focused functions with explicit names such as `generateSkin`, `updateDownload`, and `detectFace`. Keep DOM selectors as stable IDs in `index.html`; do not couple behavior to presentation classes.

Use CSS custom properties for colors and preserve responsive and `prefers-reduced-motion` rules. Canvas output must remain a transparent `64 x 64` RGBA PNG compatible with the modern Minecraft skin layout.

## Testing Guidelines

There is no committed automated test suite yet. Before publishing behavior changes, use the browser proxy to upload a representative portrait, generate a skin, inspect the visible `64 x 64` sheet, rotate the 3D preview, and verify the download. Test both `Classic` and `Slim` arm modes and both automatic and manual colors.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style messages: `feat: add Minecraft Skin Forge` or `fix: load Three.js controls in browser`. Keep commits scoped to one user-visible change. Pull requests should state the user impact, list browser checks performed, and include screenshots for layout or skin-rendering changes.
