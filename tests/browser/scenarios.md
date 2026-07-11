# Task 9 browser scenarios

Use the shared browser proxy only. Do not add another automation dependency or use a real person’s photo.

1. Open `#/studio` with IndexedDB enabled, edit and save `Offline Builder`, reload, and confirm the active look and complete look list persist.
2. Disable IndexedDB, reload, confirm the accessible memory-only notice, then compile and download Minecraft and an acknowledged Roblox Classic package.
3. Visit dependable routes while intercepting experimental module files with failures; confirm studio, library, and both exports remain usable.
4. Open `#/experimental/capture`, choose a synthetic JPEG larger than 2048 px, set each supported role and focus control, and confirm the normalized preview is at most 2048 px and no network request occurs.
5. Analyze the synthetic image, inspect warnings/confidence, reject once, analyze again, accept selected fields, reload, and confirm only accepted semantic fields persist.
6. Delete one photo, all photos, one nonfinal look, and the entire person only through their confirmations. Confirm metadata lists update and deleted photo provenance reads as deleted.
7. Start both compilers together, force one to fail, and confirm the other preview/download remains available with its exact filename and MIME type.
8. Navigate away while normalization, analysis, compilation, and optional viewer loading are pending. Confirm stale results are discarded and object URLs, bitmaps, canvases, buffers, and animation frames are released.

## Verification evidence

- Date: 2026-07-11
- Runtime: Node 22 static test server at `http://127.0.0.1:8000/my-avatars/` and the shared Playwright browser proxy.
- Automated suite: 192 tests passed with zero failures. Coverage includes deterministic artifact digests, exact preview parity, compiler isolation, mixed identity/recipe/proposal persistence, update safety, look/photo deletion without draft loss, provenance recovery, durable and memory-only retained-photo retrieval, photo-free backup replacement and pristine-only atomic disaster recovery, proposal authority, stale async guards, PWA policy, and controller source guards.
- Chromium default studio: passed. The Block Adventure shell, manual palette controls, Classic/Slim controls, outer-layer control, explicit Roblox acknowledgement, seven Roblox limitations, local library, and photo-optional privacy copy were visible without supplying a photo.
- Chromium Minecraft Classic and Slim: passed. Both produced a real PNG blob URL after all nine local preflight checks passed, including exact 64 by 64 dimensions, decoded-pixel digest, required base regions, hat-layer hair, and enabled outer layers.
- Chromium Roblox Classic: passed. The acknowledged compile produced real ZIP, shirt-preview, and pants-preview blob URLs after all ten local checks passed, including exact 585 by 559 dimensions, required regions, outside transparency, canonical manifest consistency, and privacy-safe text entries.
- Chromium save/reload/library: passed. An expression edit saved as Avatar 2 and survived reload; a keyboard Enter action on Save created Avatar 3; the library then listed Avatar 1, Avatar 2, and Avatar 3.
- Chromium optional capture route: partial. The lazy route loaded and exposed retained-photo selection, role, focus, confirm/cancel, analyze, proposal accept/reject, manual-correction, and explicit quota retry/delete-unused/continue-unsaved controls. The proxy cannot attach a synthetic file, so normalization, proposal, photo deletion, and confirmation behavior remain covered by automated tests rather than claimed as live browser observations.
- Chromium backup recovery: export passed. The Library route explained that backups exclude photos, and Prepare backup produced an announced, downloadable JSON blob URL. File attachment is unsupported by this proxy, so matching-library import and the separately confirmed atomic restore-as-new-person path remain automated-only evidence.
- Chromium 3D failure: passed. With optional Three.js assets absent, the UI announced that 3D was unavailable while exact 2D preview and download remained usable.
- Chromium accessibility snapshot: blocked by the shared proxy (`'Page' object has no attribute 'accessibility'`). Keyboard activation of Save passed, but a full accessibility-tree audit is not claimed.
- Still pending in a capable release browser/device matrix: mobile viewport and touch behavior, reduced-motion observation, request interception proving zero photo egress, Cache Storage/offline toggling, camera denial, file-picker capture/confirm/cancel, and destructive photo/look/person confirmations. Automated contract tests cover their underlying policies but are not a substitute for those release observations.
