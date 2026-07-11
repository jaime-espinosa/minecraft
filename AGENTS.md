# Repository Guidelines

## Project Structure & Module Organization

This is a static GitHub Pages application. Keep the root intentionally small:

- `index.html` contains the accessible My Avatars interface and stable control IDs.
- `styles.css` owns the responsive visual system and layout.
- `app.js` is the small browser bootstrap; focused controllers live under `src/integration/`.
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

Use modern browser JavaScript with `const`/`let`, semicolons, and two-space indentation. Prefer focused functions with explicit names such as `compileMinecraft`, `renderPreflight`, and `analyzePhoto`. Keep DOM selectors as stable IDs in `index.html`; do not couple behavior to presentation classes.

Use CSS custom properties for colors and preserve responsive and `prefers-reduced-motion` rules. Canvas output must remain a transparent `64 x 64` RGBA PNG compatible with the modern Minecraft skin layout.

## Testing Guidelines

Run `npm test` for the committed Node test suite. Before publishing behavior changes, also use the shared browser proxy and the synthetic-only matrix in `tests/browser/scenarios.md`. Verify photo-free startup, saved-look persistence, Minecraft Classic and Slim output, Roblox Classic preflight and previews, local capture confirmation, accessible fallbacks, and downloads without checking private photos into the repository.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style messages: `feat: add My Avatars export` or `fix: load Three.js controls in browser`. Keep commits scoped to one user-visible change. Pull requests should state the user impact, list browser checks performed, and include screenshots for layout or avatar-rendering changes.
