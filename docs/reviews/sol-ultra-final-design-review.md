# Provenance Note

This is the preserved GPT-5.6 Sol final review. The artifact statement that Sol Ultra was unavailable is incorrect: the review session used `gpt-5.6-sol` with `ultra` reasoning. `docs/FINAL_SOLUTION.md` is authoritative.

# Final decision: Mode-Isolated Modular Workbench

Ratify a deliberate hybrid:

- Gemini’s explicit Modular Workbench—avatar stage, ingredient grid, focused sheets.
- Separate Solid and Experimental route modules sharing only the canonical avatar.
- A Workshop surface with structured controls, command input, diffs, and version history.
- Recipe, Minecraft-pixel, and failure-isolation contracts before any production DOM rewrite.

This review remained read-only. No files, commits, deployments, or external product state were changed.

## 1. Findings, ordered by severity

### P0 — The planned photo-free default cannot use today’s generator

`auto-colors` starts enabled, `generateSkin()` calls `paletteFromImage()`, and that path dereferences `sourceImage`. The submit path is also explicitly upload-gated in [index.html](/home/jaime/kids/minecraft/index.html:68) and [app.js](/home/jaime/kids/minecraft/app.js:132).

The Solid plan’s instruction to create a default recipe, map it into existing controls, and call `generateSkin()` will therefore preserve the wrong source of truth and can fail without a photo ([Solid plan](/home/jaime/kids/minecraft/docs/superpowers/plans/2026-07-10-solid-avatar-studio-implementation.md:168)).

Decision: the default must travel through a recipe-to-RGBA module that has no DOM or photo dependency.

### P0 — Optional 3D infrastructure currently controls whether Solid starts

`app.js` statically imports and immediately constructs the viewer ([app.js](/home/jaime/kids/minecraft/app.js:1)); `viewer.js` imports Three.js and OrbitControls from unpkg ([viewer.js](/home/jaime/kids/minecraft/viewer.js:1)). A CDN, import, WebGL, or renderer failure can prevent all upload and generation handlers from initializing.

The plan recognizes this but delays correction until after the broad UI rewrite ([Solid plan](/home/jaime/kids/minecraft/docs/superpowers/plans/2026-07-10-solid-avatar-studio-implementation.md:191)).

Decision: exact 2D preview and export become the baseline; Three.js becomes a lazy enhancement before UI surgery.

### P0 — The proposed recipe and validator are not authoritative contracts

The draft recipe permits arbitrary patches, including caller-controlled `hair.layer`. Hat-layer placement must be an unchangeable composer invariant, not editable recipe data.

The proposed validator accepts a body region if one alpha pixel exists ([Solid plan](/home/jaime/kids/minecraft/docs/superpowers/plans/2026-07-10-solid-avatar-studio-implementation.md:135)). That does not prove:

- correct UV faces;
- complete Classic/Slim geometry;
- independent left/right limbs;
- outer-layer placement;
- transparent unused regions;
- meaningful hat-layer hair;
- preview/export identity.

Decision: `SkinComposer` returns only a validated artifact. Tests compare decoded RGBA and a deterministic pixel digest, not browser-dependent PNG byte encoding.

### P0 — The current fidelity display must be removed

The current score compares generated pixels with a renderer-authored, palette-dependent target and displays the result as a face score ([app.js](/home/jaime/kids/minecraft/app.js:79)). The handoff already says `0.9327` substantially overstates visible similarity ([HANDOFF.md](/home/jaime/kids/minecraft/docs/HANDOFF.md:64)); the new design expressly disallows this evidence ([mobile design](/home/jaime/kids/minecraft/docs/superpowers/specs/2026-07-10-mobile-avatar-studio-design.md:70)).

The inspected [reference image](/home/jaime/.codex/generated_images/019f4844-6061-70f1-ab07-87dc6c6b5dc9/exec-591185bb-0f1e-48df-922f-d989969764de.png) is excellent art direction—warm field, dark silhouette, expressive face, dimensional curls—but its free-standing curls extend beyond legal Minecraft hat geometry. It cannot be a WYSIWYG output promise.

Decision: remove the score from production. Use the image as a mood and quality reference only. The product stage must always show the exact legal skin artifact.

### P0 — Automatic raw telemetry is not ready for a child-heavy product

The specification automatically sends every Experimental instruction and retains raw text for seven days ([mobile design](/home/jaime/kids/minecraft/docs/superpowers/specs/2026-07-10-mobile-avatar-studio-design.md:92)); the backend plan queues and submits every command ([backend plan](/home/jaime/kids/minecraft/docs/superpowers/plans/2026-07-10-free-feedback-workshop-backend-implementation.md:79)).

Decision:

- Local Experimental commands ship independently.
- Remote command-text telemetry remains default-off until a dedicated child-privacy, consent, deletion, and data-minimization review passes.
- When enabled, sharing is separately disclosed and unselected by default.
- Telemetry receives only a minimized command/outcome projection. It receives no photos, masks, recipes, canvas references, skin pixels, names, or device fingerprint.
- Research Contribution remains a different, explicit opt-in.

This is a conservative product launch gate, not a legal determination.

### P0 — Workshop authentication is infeasible as currently connected

Two independent issues exist:

- The session cookie is scoped to `/api/workshop`, but authenticated preview is planned at `/api/config/preview`; the cookie will not accompany that endpoint ([backend plan](/home/jaime/kids/minecraft/docs/superpowers/plans/2026-07-10-free-feedback-workshop-backend-implementation.md:45)).
- A `SameSite=Strict` Worker cookie cannot reliably authenticate requests made from the GitHub Pages origin if the Worker lives on a separate site.

Decision: keep the public PWA on GitHub Pages, but serve the owner-only Workshop shell and every authenticated endpoint from the Worker origin:

- `/workshop/`
- `/api/workshop/setup`
- `/api/workshop/login`
- `/api/workshop/config/preview`
- `/api/workshop/publish`
- `/api/workshop/restore`

The cookie is therefore first-party and scoped consistently. Workshop remains an Experimental capability, not a third public mode.

The private bootstrap token belongs in the URL fragment, is removed with `history.replaceState()` immediately, and is never included in request URLs or referrers.

### P1 — Solid/Experimental isolation is currently a convention, not a seam

The command plan combines avatar actions, design-token actions, history, and publishing in one operation allowlist and one `app.js` coordinator ([command plan](/home/jaime/kids/minecraft/docs/superpowers/plans/2026-07-10-experimental-command-engine-implementation.md:28)).

Decision:

- Solid and Experimental have separate route modules, CSS scopes, operation schemas, reducers, and imports.
- Solid receives no telemetry or remote-config capability.
- Experimental is dynamically imported only after mode selection.
- Remote design values apply only beneath the Experimental route root, never `:root`.
- The shared state is one validated `AvatarFrame`; prompt history, design tokens, Workshop state, and photo sessions never cross into Solid.

### P1 — The delivery sequence contradicts the meaning of “complete Solid”

The design’s delivery sequence places commands before persistence and PWA work ([mobile design](/home/jaime/kids/minecraft/docs/superpowers/specs/2026-07-10-mobile-avatar-studio-design.md:191)), while the roadmap’s first promotion gate correctly requires reload, storage failure, and offline behavior before Experimental.

Decision: local library, exact 2D export, viewer failure isolation, offline reload, install/update behavior, and deployment tests all belong inside the Solid milestone.

### P1 — The PWA plan does not own its dependencies

Fonts currently load from Google and Three.js from unpkg, but the planned service worker caches same-origin Solid assets only. That cannot yield dependable offline presentation.

Decision:

- Self-host critical font files or use system fallbacks.
- Remove runtime font `@import`.
- Keep the deterministic 2D path entirely same-origin.
- Vendor Three.js if offline 3D is desired; otherwise label it optional.
- Use `start_url: "./#/solid"` and `scope: "./"` for the GitHub Pages project path.
- Cache no photos, telemetry responses, or Workshop responses.
- Cache Experimental model assets only after entry into a gated experiment and provide a deletion control.

### P2 — The saved mockups are useful but not implementation specifications

The later default-avatar mockup establishes the correct product hierarchy ([default-avatar-studio.html](/home/jaime/kids/minecraft/.superpowers/brainstorm/2-1783705202/content/default-avatar-studio.html:4)). The earlier guided-capture and required three-photo mockups are obsolete as first-run flows and belong only inside gated Experimental photo work ([capture-sequence.html](/home/jaime/kids/minecraft/.superpowers/brainstorm/2-1783705202/content/capture-sequence.html:4)).

Their 8–10px labels, decorative phone proportions, brush-only corrections, and missing mode/library/Workshop states must not be copied literally.

## 2. Gemini recommendations: accept, reject, or modify

- **Accept:** the current portrait-first DOM fundamentally mismatches the approved default-first product.

- **Reject:** “completely rewrite the DOM and SkinComposer before other work.” Recipe, operation, pixel, and preview-failure contracts come first.

- **Accept:** Modular Workbench as the primary interaction structure—persistent avatar stage, explicit ingredients, and focused sheets.

- **Reject:** Immersive Lookbook as the primary structure. Gesture conflicts, hidden navigation, glass overlays, and dependence on 3D make correct use too difficult.

- **Reject:** Contextual Crafter’s 3D body-part raycasting as primary navigation. Small hit areas and WebGL dependence violate the dependable baseline. The avatar may offer decorative hotspots later, but explicit ingredient buttons remain authoritative.

- **Modify:** the floating Solid/Experimental switch becomes a full-width, semantic segmented route navigation beneath the app header.

- **Modify:** fixed `45vh/55vh` geometry becomes height- and safe-area-aware stage sizing. A fixed stage fails short phones and virtual-keyboard states.

- **Modify:** `80vh` bottom sheets become `max-height:min(86dvh, 720px)`. Camera, masking, and keyboard-heavy work becomes full-screen on constrained phones.

- **Reject:** pulsing ingredient hints. Use a static one-time coach mark.

- **Modify:** the Workshop console treatment. Retain a distinct deep-ink surface, version log, and command field, but add structured token controls and diffs. Do not use black/green “hacker” cosplay or imply code execution.

- **Accept:** 16px inputs, accessible live outcomes, non-destructive errors, short transform/opacity motion, and reduced-motion support.

- **Modify:** 44px becomes an absolute floor; design to 48×48px.

- **Modify:** Fraunces, Space Grotesk, and DM Mono remain the typographic direction, but they must be self-hosted with resilient system fallbacks.

- **Reject:** any named Gemini model being “essential.” Gemini/AGY is a valuable independent critic; it is not the architecture authority and should not perform an unsupervised big-bang rewrite.

## 3. UI variants compared

### Variant A — Modular Workbench

A bounded avatar stage sits above an explicit ingredient grid. Each ingredient opens a focused sheet.

Its caller interface is obvious: choose one of nine labeled categories, edit a reversible draft, then apply it. The sheet hides preset resolution, saved choices, manual tuning, and future photo workflows. This provides the best accessibility and discoverability.

Its weakness is vertical scrolling on short phones.

### Variant B — Stage-First Rail

The avatar occupies more of the initial viewport; ingredient categories live in a horizontal rail with a sticky Download action.

This optimizes the first-time path and gives the avatar visual dominance. Its external interface is smaller, but later ingredients become off-screen and horizontal overflow is easy for children to miss. Adding “See all” repairs the problem by recreating the Workbench grid.

Useful insight retained: the avatar and Download must appear before the full catalog.

### Variant C — Split-Shell Studio

Solid and Experimental are separate route modules under one shell and share only the current validated avatar. This offers the strongest seam placement and locality: Experimental imports, telemetry, configuration, and Workshop state cannot accidentally become Solid dependencies.

Its cost is some duplicated route composition and preview remounting.

### Variant D — Immersive/Contextual canvas

A full-screen 3D avatar becomes navigation, with swipes, hotspots, carousels, and overlays.

It is visually dramatic but easy to misuse, difficult without WebGL, and poorly suited to screen readers, switch access, and small targets. Reject it as the product architecture.

### Selected hybrid

Use Variant A’s explicit workbench, Variant C’s hard mode isolation, and Variant B’s stage-first priority.

Name: **Mode-Isolated Modular Workbench**.

## 4. Final information architecture

### Public PWA

- `./#/solid` — default Studio.
- `./#/solid/library` — Saved Avatars.
- `./#/experimental` — Experimental Lab.

The mode navigation remains visible and preserves the avatar when switching.

### Worker-origin Workshop

- `/workshop/#/login`
- `/workshop/#/setup?bootstrap=…`
- `/workshop/#/preview`
- `/workshop/#/versions`

The public Experimental screen contains “Open Developer Workshop.” The Workshop shell visually identifies itself as `Experimental / Workshop`; it is not another public top-level mode.

## 5. Deep modules and interfaces

The graph shows today’s code as one DOM-heavy generation cluster and one comparatively cohesive viewer cluster. Preserve the viewer idea, but place the authoritative seam below every UI.

```ts
type AvatarFrame = {
  revision: number;
  recipe: AvatarRecipeV1;
  model: 'classic' | 'slim';
  rgba: Uint8ClampedArray; // exactly 64 * 64 * 4
  pixelDigest: string;
};

interface AvatarKernel {
  start(seed?: unknown): Result<AvatarFrame, RecipeFault>;

  transact(input: {
    baseRevision: number;
    operations: readonly AvatarOperation[];
  }): Result<AvatarFrame, AvatarFault>;
}

interface StudioSession {
  snapshot(): Readonly<StudioSnapshot>;
  perform(intent: StudioIntent): Promise<StudioOutcome>;
  observe(listener: (snapshot: StudioSnapshot) => void): () => void;
}
```

`AvatarKernel` is an in-process deep module. Its implementation hides defaults, migrations, UV coordinates, painting order, shading, outer layers, hat-layer enforcement, validation, and deterministic composition.

`StudioSession` is the UI/test interface. It hides history, draft transactions, persistence recovery, export encoding, preview updates, and announcements. Deleting it would scatter atomicity, recovery, history, and artifact ownership across every caller; it therefore earns depth and locality.

### Canonical terminology

The versioned recipe contains:

- `model`
- `face`
- `hair`
- `skin`
- `expression`
- `top`
- `bottom`
- `shoes`
- `accessory`

“Body” is a UI editing category backed by `recipe.model`; it is not a reusable ingredient. Hair has no caller-settable layer field.

### Interface invariants

- `start()` always returns a complete polished avatar or a blocking contract fault.
- Every successful frame is modern 64×64 transparent RGBA.
- Hair is written to the hat layer by implementation, never caller choice.
- Transactions are immutable and atomic.
- A failed candidate leaves the prior frame and download available.
- Stale revisions are rejected.
- Identical recipe/version inputs produce identical RGBA and pixel digest.
- The 2D sheet, PNG, thumbnail, and 3D texture consume the same frame revision.
- Solid performs no telemetry/config fetch and reads no Experimental design token.
- Storage, preview, network, telemetry, and Workshop failures are non-blocking for the current valid avatar.

Blocking faults are `INVALID_RECIPE`, `INVALID_OPERATION`, `STALE_REVISION`, `COMPOSE_FAILED`, `UV_INVARIANT_FAILED`, and `ENCODE_FAILED`.

Degraded warnings include `STORAGE_UNAVAILABLE`, `PREVIEW_UNAVAILABLE`, `REMOTE_UNAVAILABLE`, `TELEMETRY_DISABLED`, `REMOTE_QUOTA_DISABLED`, and `UPDATE_AVAILABLE`.

### Real seams and adapters

- `PreviewPort`: exact 2D adapter and lazy Three.js adapter.
- `AvatarLibrary`: IndexedDB adapter and ephemeral-memory adapter.
- `ExperimentalConfigPort`: HTTP adapter, in-memory test adapter, and disabled adapter.
- `TelemetryPort`: Worker adapter, in-memory test adapter, and disabled adapter.
- `WorkshopConfigPort`: authenticated HTTP and in-memory test adapters.

The composer, recipe reducer, validator, and migrations are internal implementations, not adapters.

Do not establish a production `FeatureAnalyzer` port yet. Until the renderer spike passes, that would be a hypothetical seam surrounding speculative implementation.

### Data flow

```text
Solid UI / Experimental parser / Saved Avatar
                    |
             StudioSession.perform
                    |
           AvatarKernel.transact
                    |
      SkinComposer + validator (internal)
                    |
                AvatarFrame
          /          |           \
     2D stage     PNG export    PreviewPort
          \
           AvatarLibrary

Experimental text ──> local parser ──> AvatarOperation[]
                  └─> minimized outcome ──> TelemetryPort

Local photo session ──> feature draft ──> validated ingredient operation
Research contribution ──> separate explicit consent/upload path

Workshop operations ──> versioned Experimental config only
```

## 6. State model and isolation

Avoid one global collection of booleans. Use small machines:

- **Shell:** `booting → ready`; parallel connectivity, install, and update state.
- **Avatar session:** always contains one valid frame; `idle | transacting | encoding`.
- **Solid route:** `ready`; one overlay at a time—ingredient, library, skin sheet, save, or export.
- **Ingredient sheet:** `closed | editing-draft | applying | error`.
- **Experimental route:** `first-entry | idle | parsing | applied | partial | unsupported | rejected`.
- **Telemetry:** `disabled | sending | queued | dropped`; independent of parser success.
- **Workshop:** `checking | setup | locked | authenticated | schedule-closed`; authenticated substates `preview | editing | publishing | restoring | conflict | session-expired`.
- **Preview:** `exact-2d | loading-3d | three-ready | three-unavailable`.
- **Storage:** `opening | persistent | session-only`.

Mode switching shares only `AvatarFrame`. Experimental command history, remote styles, Workshop privilege, telemetry state, and photo working data stay route-local.

Use three distinct operation schemas:

1. `AvatarOperation` for recipes.
2. `LocalExperimentalViewOperation` for temporary Experimental presentation.
3. `WorkshopConfigOperation` for authenticated, versioned public configuration.

No parser may return a mixed privileged batch.

Workshop configuration may never modify Solid, Minecraft invariants, authentication controls, privacy copy, focus visibility, minimum type size, minimum targets, or reduced-motion behavior.

## 7. Screen-by-screen mobile specification

### First open

- Safe-area-aware 56px header: Skin Forge, My Avatars, overflow Help/Install.
- 52px segmented mode navigation immediately below; Solid selected.
- Reserve the stage immediately and render the exact 2D default without waiting for storage, network, fonts, or Three.js.
- Lazy-upgrade to the 3D player in place.
- Show `Player` and `Skin file` stage tabs.
- Show explicit Rotate left, Rotate right, and Reset controls; drag is optional.
- Primary row: `Save` and `Download PNG`. Download is immediately enabled.
- Static coach copy: “Choose any part below to make it yours.”
- Two-column ingredient grid begins beneath the actions.
- No upload prompt, fidelity score, onboarding modal, telemetry, or install interruption.

### Solid Studio

Ingredient categories are Face, Hair, Skin Tone, Expression, Top, Bottom, Shoes, Body, and Extras.

Each card shows:

- category;
- current preset/value;
- swatch or exact thumbnail;
- `Change` accessible name.

The stage remains the protagonist, but it is not globally fixed. On sufficiently tall phones it may be sticky beneath the header; on short phones and while a keyboard is open, sticky behavior is disabled.

The 2D sheet is a first-class inspection view, not an error fallback hidden from normal users.

### Ingredient sheet

Use a semantic `<dialog>`.

- Current ingredient and base value at top.
- Preset radio cards first.
- Saved device-local choices second.
- Fine-tuning controls third.
- `Keep current` and `Apply` in a persistent footer.
- Selecting a choice creates a draft artifact and labels the stage `Preview`.
- Apply validates and commits atomically.
- Close, Escape, or Keep current discards the draft and restores the exact base revision.
- No swipe-only dismissal.
- Return focus to the ingredient card.
- Solid contains no photo action.
- After the renderer gate, Experimental may add `Try a photo`, leading through capture/import, quality guidance, focus correction, review, and Apply within the same dialog state machine.
- Provide crop/preset/full-area and keyboard polygon alternatives to brush editing.

### Saved Avatars

A full route, not a sheet.

- Heading: `Saved on this device`.
- Two-column cards: thumbnail, local name, Classic/Slim, last edited.
- Actions: Open, Duplicate, Delete.
- Opening another avatar with unsaved work offers Save, Discard, or Cancel.
- Deletion requires explicit confirmation.
- Empty state: “No saved avatars yet” and `Save current avatar`.
- Storage failure state: “Saving is unavailable on this device. Your current avatar and download still work.”
- Clearing site data is explained as clearing this library.

### Experimental mode

Switching preserves the exact avatar.

First entry shows concise, non-blocking disclosure:

> Commands run on this device. Photos stay here unless you separately contribute to research. Sharing command text is off.

Immediately beneath it:

- 16px instruction field;
- 48px Submit button;
- local-processing badge;
- two example commands;
- command history;
- telemetry status separate from parser status.

When the virtual keyboard opens, the stage may scroll away. Keep the input and result adjacent; do not compress them behind a fixed 3D stage.

Photo experiment cards remain absent or visibly unavailable until the fidelity gate passes.

### Local instruction result

Every result uses one status:

- Changed
- Partially changed
- Unsupported
- Rejected
- Failed

Show the exact interpreted changes and ignored clauses:

> Changed: Top → dark blue  
> Ignored: “make it sparkly” is not supported.

Successful local mutations offer Undo. Unsupported or rejected input changes nothing and suggests supported wording. Announce the outcome through a polite live region.

Parser and remote status are independent:

> Hair shortened locally. Improvement sharing is offline.

### Workshop setup

The one-time URL opens the Worker-origin Workshop shell.

- Read the bootstrap token from the fragment.
- Immediately remove it from browser history.
- Use `Referrer-Policy: no-referrer`.
- Confirm the Worker reports `uninitialized`.
- Explain that one shared password will protect preview and publishing.
- Fields: Password, Confirm password, Show password.
- Explain: “There is no email recovery. Reset requires a new private setup URL.”
- On success, atomically close setup, establish the first-party session, and open Private Preview.
- A second setup attempt is rejected without revealing authentication details.

### Workshop login

- One password field; no account/email fiction.
- `autocomplete="current-password"`.
- Show/hide control.
- Availability or scheduled-closure state before submission.
- Increasing retry delay and generic failure copy.
- Offline state: “Workshop needs a connection. Avatar Studio still works.”
- Session expiration preserves a local unsaved preview draft, then requests login before remote action.

### Workshop preview, publish, and rollback

Header:

> Workshop · Private preview · Version N

The preview always displays a visible `Private` marker.

Use three tabs:

- **Controls:** constrained colors, typography, spacing, visibility, and component order.
- **Command:** the shared instruction style for supported configuration requests.
- **Versions:** immutable history.

Every change produces a structured diff against the current public version. Valid preview changes may be saved as new private preview versions.

Publish opens a confirmation summarizing:

- current public version;
- proposed preview version;
- changed tokens/components;
- affected Experimental screens.

The destructive button reads `Publish to Experimental`.

Undo reverses the latest preview operation. Restore selects an older version into a new preview; it does not rewrite history. Public rollback is `restore to preview → inspect diff → publish`, with a second confirmation.

Optimistic concurrency uses `baseVersion`/ETag. A conflict refreshes the public head while preserving the local draft and presenting a new diff.

Workshop never accepts executable strings, URLs, HTML, JavaScript, workflow instructions, or repository commands.

### Offline and error behavior

Offline is the normal app plus a 36px non-blocking banner:

> Offline — avatar making and download still work.

There is no separate degraded editor.

- WebGL/Three.js failure: exact 2D stage; “3D preview unavailable. Your skin is still ready.”
- IndexedDB failure: session-only library.
- Worker failure: local commands continue; last valid public Experimental config remains.
- Telemetry/quota failure: sharing pauses silently except for a status indicator.
- Photo analysis failure: retain current ingredient; Retry, Keep current, Use full crop, or Choose preset.
- Invalid candidate artifact: retain prior valid frame and its download.
- Service-worker update: “New version ready” with user-controlled Reload; never force-refresh active work.

### PWA installation education

Never interrupt first open.

After a successful save/download—or from Help—show one dismissible education card:

> Install Skin Forge  
> Open it like an app and keep Solid available offline on this device.

- If a native install event is available, `Install` invokes it from the user’s tap.
- Otherwise, show platform-specific browser-menu/Add-to-Home-Screen instructions.
- Offer `Not now`.
- Do not claim offline readiness until the service worker is active and a cached Solid reload has passed.
- Stop displaying education after confirmed standalone use or dismissal cooldown.

Platform-specific installation behavior must be verified on real target browsers before release.

## 8. Visual direction and tokens

The direction is “modern craft table”: warm editorial paper, dark forest ink, strong block geometry, restrained rounding, and a legal Minecraft avatar as the dominant visual object. Avoid glassmorphism, neon-gamer styling, and babyish cartoon chrome.

```css
:root {
  --paper: #F6F1E4;
  --surface: #FFFDF7;
  --surface-raised: #FFFFFF;
  --surface-muted: #E4EBDD;

  --ink: #16251E;
  --ink-muted: #536159;
  --line: #223D33;

  --brand-copper: #C9643B;      /* decorative */
  --solid-action: #A94728;      /* white text: 5.8:1 */
  --solid-action-hover: #84351F;
  --solid-soft: #F5D9CD;

  --experimental: #245F69;      /* white text: 7.2:1 */
  --experimental-soft: #CDE7E5;

  --moss: #315D3B;
  --sun: #E8C868;
  --success: #2F6B44;
  --warning: #8A5B00;
  --danger: #A12C2C;
  --focus-ring: #1C6DD0;

  --workshop-bg: #152019;
  --workshop-fg: #F6F1E4;
  --workshop-accent: #B9F6C4;
  --scrim: rgb(22 37 30 / 56%);
}
```

### Typography

Self-host WOFF2 files; system fallbacks are mandatory.

- Display: Fraunces 700/800, Georgia fallback.
- UI: Space Grotesk 500/600/700, system sans fallback.
- Data/Workshop: DM Mono 500, system monospace fallback.
- Display: `clamp(2rem, 7vw, 3rem) / .98`.
- Screen title: `1.5rem / 1.875rem`.
- Section: `1.25rem / 1.625rem`.
- Body and every input: `1rem / 1.5rem`.
- Metadata: `.875rem / 1.25rem`.
- `.75rem / 1rem` only for nonessential badges.

### Spacing and shape

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px.
- Phone gutter: 16px.
- Tablet gutter: 24px.
- Radii: 8px controls, 14px cards, 24px sheets.
- Borders: 2px for major interactive surfaces.
- Primary hard shadow: `4px 4px 0 var(--line)`.
- Minimum target: 48×48px with at least 8px between adjacent controls.

### Responsive layout

- Under 480px: one-pane layout; stage `clamp(240px, 36svh, 320px)`.
- 480–767px: stage `clamp(280px, 40svh, 400px)`.
- 768–1119px: two-pane, stage left and workbench right.
- 1120px and above: maximum 1200px shell with a 5/7 split.
- Under 640px viewport height: cap stage at 220px and disable sticky positioning.
- Ingredient grid uses `repeat(auto-fit, minmax(132px, 1fr))`, naturally collapsing to one column under extreme zoom.

### Sheets and dialogs

- Mobile ingredient sheet: `max-height:min(86dvh, 720px)`.
- Short-height, camera, masking, and keyboard-constrained states: full-screen dialog.
- Desktop/tablet: 420px right-side dialog.
- Visible Close button, focus containment, inert background, Escape support, and focus restoration.

### Motion

- Press feedback: 120ms.
- General transition: 180ms.
- Sheet enter: 220ms ease-out.
- Animate only transform and opacity.
- No pulsing, automatic stage rotation, parallax, or essential animation.

With reduced motion:

- durations become zero;
- sheets appear in place;
- no smooth scrolling or crossfades;
- 3D renders only on explicit interaction or texture change;
- every state change remains textually announced.

### Empty, loading, and error states

- Avatar: never empty.
- Library empty: one plain card plus `Save current avatar`.
- 3D loading: exact 2D remains visible with a small `Loading 3D preview…` badge.
- Ingredient processing: named steps and Cancel, with current avatar retained.
- Errors: inline beside the responsible action. Toasts are reserved for confirmations.
- Skeletons may reserve layout but must not delay the synchronous default artifact.

## 9. Accessibility, privacy, and failure rules

### Accessibility

- DOM order: header, mode navigation, stage, primary actions, ingredients.
- Mode control uses native links with `aria-current="page"`.
- Every ingredient button includes its current value in the accessible name.
- 3D drag always has Rotate left/right/reset alternatives.
- Do not expose an unlabeled WebGL canvas as an “interactive preview.”
- Presets use radio semantics; selected states include text/checkmarks.
- Color controls include color names or hex values.
- Dialogs return focus to their opener.
- Status outcomes are polite; blocking validation errors use `role="alert"`.
- Support keyboard, switch access, 200% zoom, forced colors, and high contrast.
- Photo focus offers a non-brush path.
- No privilege, mode, success, or error state is color-only.

### Privacy

- Normal photos remain transient and local.
- Source photos are not placed in service-worker caches, IndexedDB, thumbnails, logs, telemetry, or URLs.
- Saving a photo-derived ingredient stores the derived recipe/features only, after explicit confirmation.
- The photo module receives no telemetry capability.
- The telemetry module receives no canvas, blob, image, mask, recipe, or DOM capability.
- First names and avatar names remain local.
- Research Contribution lists exactly what will upload and requires a separate unselected action for each contribution session.
- Research uploads remain disabled until consent versioning, deletion, retention, storage caps, and automatic quota shutoff pass.
- Self-host runtime assets and use a restrictive CSP; third-party runtime scripts undermine the local-photo promise.

### Failure mapping

| Failure | User experience | What remains available |
|---|---|---|
| CDN/WebGL/Three.js | Exact 2D stage plus explanation | Edit, inspect, save, export |
| IndexedDB denied/quota | Session-only notice | Edit and export |
| Worker/config outage | Last-known-good Experimental style | Solid and local commands |
| Telemetry/quota shutoff | Sharing paused | All local behavior |
| Photo/model failure | Retry/manual/preset options | Current ingredient and avatar |
| Invalid recipe/artifact | Candidate rejected | Prior frame and download |
| Workshop session expiry | Reauthenticate; preserve local draft | Public app and local avatar |
| Service-worker update failure | Continue current version | Current session and export |

## 10. Roadmap resolution

Replace the current ordering with this:

1. **Characterize existing output.** Record representative decoded Classic/Slim RGBA fixtures and current behavior before migration.

2. **Define contracts.** Specify `AvatarRecipeV1`, migrations, the complete default, `AvatarOperation`, canonical Body/model terminology, typed faults, and revision semantics.

3. **Extract the authoritative kernel.** Implement `AvatarKernel → validated AvatarFrame`; add exhaustive UV, transparency, outer-layer, independent-limb, and hat-layer tests. Remove the fidelity score from the target product model.

4. **Decouple preview and network.** Exact 2D adapter first, lazy Three.js adapter second. Prove startup/export with CDN, WebGL, storage, and network failures.

5. **Prototype the final mobile shell read-only/throwaway.** Compare the selected workbench with the Stage-First alternative using fake session data. Do not modify the production DOM until the interaction gate passes.

6. **Implement `StudioSession` and route isolation.** Shared avatar frame; separate Solid and Experimental imports, CSS scopes, and state machines.

7. **Ship a tracer-bullet Solid vertical slice.** Default avatar, stage, Hair sheet, 2D inspection, and exact download.

8. **Add remaining Solid categories and local library.** IndexedDB plus memory fallback.

9. **Add PWA/offline/install/update behavior.** Self-host critical assets and complete the Solid deployment gate.

10. **Ship Experimental locally.** Mode route and deterministic avatar commands; all remote capabilities disabled.

11. **Run the child-privacy and backend-topology gates.** Resolve telemetry consent/minimization and prove the Worker-origin Workshop shell/cookie arrangement before backend expansion.

12. **Add telemetry only if ratified.** Sanitization-before-persistence, retention, quarantine, deletion, and quota shutoff.

13. **Prototype Workshop against an in-memory server, then implement it.** Setup, login, private preview, diff, publish, undo, immutable versions, conflict, and restore.

14. **Run the photo renderer/fidelity spike once the kernel is stable.** This can proceed in parallel with late Solid work; it must precede production capture/masking UI and need not wait for Workshop.

15. **Build production photo ingredients only if every gate passes.**

16. **Enable Research Contribution last.**

Exact plan corrections:

- Keep the intent of Solid Tasks 1–2, but replace arbitrary patching and alpha-presence validation with the real kernel contract.
- Move current Solid Task 5 ahead of production DOM changes.
- Split the current giant Task 3 into prototype, one vertical slice, and expansion.
- Complete library/PWA/offline before Experimental.
- Replace “byte-identical PNG” with decoded RGBA/pixel-digest identity.
- Split local avatar, local design, and privileged Workshop operation schemas.
- Move authenticated preview beneath `/api/workshop/*`.
- Add immutable config versions plus separate preview/public channel heads and the missing audit-event schema.
- Add child-privacy and same-origin authentication gates before remote enablement.
- Execute the photo spike earlier while keeping photo promotion gated.

## 11. Prototypes and evidence gates

### Contract gate

- Complete default without DOM, photo, network, storage, or viewer.
- Golden decoded RGBA for Classic and Slim.
- All six required faces, independent limbs, overlays, transparent regions, and hat-layer hair.
- Identical recipe produces identical pixel digest.
- 2D, PNG decode, and 3D texture use the same revision.

### Mobile interaction gate

Prototype at 320×568, 390×844, 768×1024, landscape, 1280×800, and 200% zoom.

With guardian consent, test the task “change the hair and download the skin” with representative children:

- at least 7 of 8 complete without coaching within 60 seconds;
- every participant can close an ingredient sheet;
- no participant mistakes Experimental photo/research actions for required steps;
- no critical action is obscured by scroll, safe area, or virtual keyboard.

### Failure and isolation gate

- Block every network request.
- Throw during WebGL construction.
- Reject IndexedDB.
- Return malformed config.
- Expire Workshop session.
- Trigger quota cutoff and concurrent config conflict.
- Solid still creates/exports.
- Solid’s module graph imports no Experimental or Workshop entry.
- Entering/leaving Experimental does not change Solid’s decoded pixel digest.

### Accessibility gate

- Keyboard and switch path for every supported operation.
- VoiceOver and TalkBack flow.
- Correct dialog labeling and focus return.
- 48px targets.
- 200% zoom without lost controls.
- Non-brush photo correction.
- Reduced-motion and forced-colors audits.
- No command result announced twice or omitted.

### Performance gate

- Exact default 2D frame within one second on iPhone 12 Safari and the selected mid-range Android Chrome device.
- Preset composition/visual response under 100ms p95.
- Three.js loading never delays controls.
- Continuous rendering stops when hidden or unchanged.

### PWA gate

- Offline reload after one successful online visit.
- Default creation, saved recipes, and export offline.
- Correct GitHub Pages scope/start URL.
- Update recovery without data loss.
- Real-device installation education on target iPhone Safari and Android Chrome.
- Network trace proves photos and masks are never cached or transferred.

### Workshop gate

- One successful setup; every subsequent setup rejected.
- First-party cookie and consistent endpoint path.
- Origin/CSRF protection.
- Private preview marker and structured diff.
- Explicit public publish.
- Undo and immutable restore.
- Session expiration, rate limit, schedule, kill switch, conflict, last-known-good, and quota behavior.
- Invalid configuration cannot alter accessibility minima, privacy copy, Solid, or executable code.

### Photo-fidelity gate

Across 15–20 representative private cases:

- at least three blinded judgments per case;
- custom output preference at least 65%;
- Wilson 95% lower bound above 50%;
- abandonment no greater than 20%;
- model load plus inference within three seconds on both target devices;
- zero source/mask transfer in network traces;
- all Minecraft correctness and accessibility gates pass.

Failure keeps photo-derived ingredients disabled.

## 12. Implementation and review tool mix

Actually available and used in this review:

- Codebase-memory MCP, already indexed at 95 nodes/179 edges.
- Local read-only source inspection.
- The image inspection tool.
- Three parallel Codex subagents generating genuinely different interface designs.
- The saved Gemini review.

Available locally but not operational in this read-only sandbox:

- Gemini CLI 0.47 and `agy` are installed, but AGY attempted to create logs and open a localhost socket, so no live Gemini model/session was used.
- Chromium is installed, but browser automation was not connected as a callable tool.
- The documented `/home/jaime/src/_util/_browse` proxy is therefore a future implementation-session tool, not evidence used here.

Not available as a callable tool:

- Sol Ultra. No exposed tool/model selector or matching configuration was found.
- Generic web search. No web evidence was used or cited.
- The Antigravity editing tools named by Gemini.

Recommended implementation mix:

- Codex primary agent owns contracts, integration, and evidence gates.
- Codebase-memory MCP handles discovery, impact tracing, and module-graph isolation checks.
- Parallel subagents separately audit composer invariants, accessibility, privacy/authentication, and UI regressions.
- Connect the existing browser proxy for real-device-sized screenshots, upload/export tests, failure injection, offline checks, and accessibility observation.
- Use AGY/Gemini as an independent design critic after each prototype and before integration; verify the currently available model list first.
- If Sol Ultra is separately available, use it as another bounded visual-comparison reviewer, not as architecture authority.
- Compare screenshots at the declared viewport matrix using side-by-side and overlay review. Use pixel equality for skin artifacts, not as the sole measure of UI quality.
- Include representative children and guardians in the interaction gate; no LLM substitutes for that evidence.

## Ratifiable decisions

- Adopt the Mode-Isolated Modular Workbench.
- Put recipe and Minecraft invariants before production UI replacement.
- Make exact 2D creation/export the dependable baseline; lazy 3D is optional.
- Use separate Solid and Experimental route modules sharing only `AvatarFrame`.
- Keep Body as a UI category backed by `recipe.model`.
- Make hat-layer hair a composer-owned invariant.
- Remove the current fidelity score.
- Keep production photo UI disabled until the renderer gate passes.
- Keep remote telemetry default-off until the child-privacy gate passes.
- Serve authenticated Workshop UI/API from the Worker origin.
- Require private preview, explicit publish, immutable restore, and confirmed rollback.
- Self-host critical assets and complete offline Solid before Experimental.
- Treat the generated image and HTML mockups as art/interaction references, not literal output specifications.

**Single next implementation task:** write and ratify the `AvatarRecipeV1`, `AvatarOperation`, and `AvatarKernel` recipe-to-RGBA interface plus the exhaustive Minecraft invariant test matrix—without changing the production DOM.