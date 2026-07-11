# Testing and Release Gates

## Current Manual Baseline

There is no committed automated test suite. Serve the repository locally:

```bash
python3 -m http.server 8000
```

Use the shared browser proxy for observation:

```bash
PYTHONPATH=/home/jaime/src python3 -m _util._browse.mcp_server --http --port 8767
```

The local proxy additions support upload actions and Canvas extraction. Do not publish personal comparison pages or captured photographs.

## Required Automated Layers

1. **Kernel unit tests:** deterministic recipes, operation validation, stale revisions, defaults, migration, undo/redo, and photo-free startup.
2. **Composer conformance tests:** exact RGBA fixtures for Classic/Slim layouts, all body faces, duplication, mirroring, transparency, outer layers, and hat-layer hair.
3. **Export parity tests:** decode exported PNGs and compare dimensions, RGBA, and pixel digest with `AvatarFrame`; never compare encoded bytes alone.
4. **Route isolation tests:** Solid starts when camera, segmentation, Three.js, CDN, WebGL, Worker, and telemetry fail.
5. **Persistence tests:** corrupted drafts, incompatible recipe versions, storage denial, recovery, deletion, and last-known-good behavior.
6. **Accessibility tests:** keyboard/focus order, screen-reader announcements, contrast, touch targets, reduced motion, and editor dismissal.
7. **Workshop tests:** bootstrap consumption, password verification, cookies, CSRF/origin checks, rate limits, conflicts, preview, publish, restore, audit, and kill switch.
8. **Privacy tests:** payload allowlists, PII rejection, injection quarantine, seven-day deletion, quota cutoff, and proof that photos/canvas/skins are absent from requests.
9. **PWA tests:** installability, self-hosted critical assets, offline Solid startup, update behavior, and cache recovery.

## Browser Matrix

At minimum, test current Chrome on Android/desktop, Safari on iPhone, and Edge or Chrome on Windows. Test small phones, rotation, camera denial, photo-library selection, low-memory reload, offline mode, and installed/home-screen mode.

Manual release checks include:

1. Start without a photo and receive a complete default skin.
2. Upload representative face, hair, and outfit images independently.
3. Adjust crop/highlight and ingredient controls by touch.
4. Inspect the exact `64 x 64` sheet at a useful scale.
5. Rotate the base and outer layers in 3D when available.
6. Generate and download both Classic and Slim skins.
7. Import the PNG into a compatible Minecraft skin viewer/game flow.
8. Confirm hair appears on the hat layer and can be inspected separately.
9. Disable network/WebGL and confirm Solid editing/export still work.

## Independent Fidelity Gate

The old `0.9327` metric is prohibited as release evidence. Before enabling photo-derived ingredients as a quality claim:

1. Freeze an independently authored target set and evaluation procedure before tuning.
2. Use at least 15-20 varied consented cases covering skin tones, hair shapes/textures, glasses, lighting, backgrounds, and age-appropriate inputs.
3. Compare original photos, hand-authored composite targets including hat hair, and site outputs.
4. Use blinded human ranking plus defined landmark/color/silhouette measures that do not share the generator's intermediate representation.
5. Separate face likeness from hair silhouette, outfit resemblance, and technical skin validity.
6. Record failures, not just averages.
7. Iterate through develop, test, deploy-to-preview, observe, and analyze; stop when improvements asymptote or regress other gates.

Personal reference images remain local and outside published fixtures.

## Release Evidence

Every release should record the source commit, environment, changed behavior, automated results, browser/device checks, representative screenshots without personal data, privacy/quota status, and rollback target. A production release is blocked by invalid skin layout, photo transmission, failed offline Solid startup, Workshop executable publishing, missing rollback, or an unpassed privacy gate for remote logging.

GitHub Pages deployment success proves hosting only. It does not prove likeness, valid exports, PWA offline behavior, privacy compliance, or Workshop safety.
