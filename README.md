# My Avatars

My Avatars is a privacy-first, browser-based studio for building one block avatar and exporting local Minecraft and Roblox Classic artifacts. The application is a static HTML/CSS/JavaScript PWA; editing, validation, and generation remain on the device.

- Planned Pages base: `/my-avatars/`
- Remote rename and deployment require separate authorization; see [the deployment runbook](deploy/rename-and-pages-runbook.md).

## Current Product

The dependable studio starts without a photo, persists saved looks locally when IndexedDB is available, falls back to memory when it is not, and composes exact Minecraft and Roblox Classic artifacts from semantic avatar choices. Optional capture normalizes and analyzes source photos only after the Experimental route is opened. The 3D Minecraft viewer remains an optional enhancement. The checked-in service worker caches only an exact public shell allowlist and never caches photos or generated downloads.

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
