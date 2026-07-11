# Skin Forge

Skin Forge is a privacy-first, browser-based studio that turns a person's visual traits into a playable modern Minecraft skin. The current production application is a static HTML/CSS/JavaScript site hosted on GitHub Pages. Image processing and PNG generation happen in the browser.

- Live site: <https://jaime-espinosa.github.io/minecraft/>
- Repository: <https://github.com/jaime-espinosa/minecraft>
- Current production baseline: `ded8b5299eb8216ae1b141199a561c8ae36ae27f`

## Current Product

The shipped site accepts a portrait, derives colors and facial cues, composes a transparent `64 x 64` modern Minecraft skin, shows the texture sheet and a rotatable Three.js model, and downloads the PNG. It includes crop controls, Classic/Slim arms, automatic or manual colors, hair styles, curl volume, expressions, and accessories. Hair is always drawn on the Minecraft hat/outer-head layer.

The current generator is useful but not a proven likeness system. Its former `0.9327` score was self-referential and must not be interpreted as perceptual similarity.

## Approved Direction

The authoritative next solution is the **Mode-Isolated Modular Workbench** described in [docs/FINAL_SOLUTION.md](docs/FINAL_SOLUTION.md). It provides:

1. A dependable Solid studio with photo-free defaults and editable ingredients.
2. An isolated Experimental studio for guided face, hair, and outfit capture.
3. A password-gated Developer Workshop for safe configuration changes.
4. Local-first generation that continues when every backend is unavailable.
5. Optional, sanitized telemetry that remains disabled until child-privacy gates pass.

## Local Development

No build step is required:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. For browser automation, use `/home/jaime/src/_util/_browse` as documented in [docs/TESTING_AND_RELEASE.md](docs/TESTING_AND_RELEASE.md).

## Documentation

Start with [docs/README.md](docs/README.md). It labels the authoritative solution, historical record, privacy policy, operations, review evidence, and implementation plans.

`face-comparison.html` contains personal image data. It must never be committed, published, attached to a release, or copied into a deployment.
