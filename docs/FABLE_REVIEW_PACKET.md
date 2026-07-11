# My Avatars — Fable Review Packet

## Purpose

This is the front door for a Fable review of the My Avatars cross-game foundation. Fable should use this packet to comment on the current product, architecture, interaction model, privacy boundary, and implementation fit, then produce one consolidated final specification.

Repository/worktree root: `/tmp/my-avatars-build`

Branch: `feat/my-avatars-foundation`

The branch is local only. It has not been pushed, deployed, published, connected to Roblox, or used to rename an external repository.

## Authority order

Read these in order:

1. [Final Solution](FINAL_SOLUTION.md) — concise product and operating source of truth.
2. [Cross-Game Foundation Design](superpowers/specs/2026-07-11-my-avatars-cross-game-foundation-design.md) — PRD-level scope, architecture, contracts, privacy rules, routes, recovery, tests, and revisit log.
3. [Implementation Plan](superpowers/plans/2026-07-11-my-avatars-cross-game-foundation-implementation.md) — Luna-executable work breakdown, file map, dependencies, gates, and model sizing.
4. [Fable Code Map](FABLE_CODEMAP.md) — direct links from product concepts to implementation modules, hard dependency edges, and validating tests.
5. [Browser Evidence Matrix](../tests/browser/scenarios.md) — what was observed in Chromium, what is covered only by automated tests, and what still requires a capable device/browser release matrix.

Supporting operational documents:

- [Privacy and Safety](PRIVACY_AND_SAFETY.md)
- [Testing and Release](TESTING_AND_RELEASE.md)
- [Operations](OPERATIONS.md)
- [Project History](PROJECT_HISTORY.md)

## Product intent Fable should preserve

- The product name is **My Avatars**. The word “skin” appears only at Minecraft compatibility boundaries.
- One person owns one local Identity Library with many saved looks.
- A polished avatar works immediately without a photo, account, network, storage, WebGL, camera, analyzer, or remote service.
- Optional photos are progressively added, normalized locally, stripped of metadata, and retained only as Normalized Source Photos on the device.
- One semantic identity feeds independent Minecraft Classic/Slim and Roblox Classic shirt/pants compilers.
- Block Adventure is the visual direction.
- Minecraft exact 2D preview/export is dependable; 3D is an optional lazy enhancement.
- Roblox upload, moderation, fees, publication, weapons, accessories, bodies, and game integration remain external or future seams.
- Mark or David may revisit presentation choices without weakening domain, privacy, persistence, validation, accessibility, or compiler contracts.

## Current implemented foundation

The local implementation includes:

- Closed domain validators, canonical JSON, and deterministic digests.
- A pure avatar kernel and privacy-safe appearance snapshots.
- Deterministic Minecraft Classic/Slim 64 × 64 PNG compilation and local preflight.
- Deterministic Roblox Classic shirt/pants/manifest/README ZIP compilation and local preflight.
- IndexedDB storage with memory fallback, deletion cascades, quota recovery, migrations, photo-free backup, and pristine-only disaster restore.
- Optional local capture, focus confirmation, palette proposals, selective acceptance, manual correction, and retained-photo reuse.
- A focused `StudioSession` state facade with compiler isolation, stale-result guards, dirty-state/update safety, and many-look persistence.
- A Block Adventure browser UI, lazy capture route, optional viewer fallback, allowlist-only PWA shell, and manual-only Pages staging safeguards.

## Decisions Fable may challenge

Fable should explicitly comment on:

1. Whether the stage-first Block Adventure layout serves children and casual creators well.
2. Whether the five-route information architecture is understandable: Build, Capture, Library, Minecraft Export, Roblox Export.
3. Whether one semantic identity plus many recipes is the right mental model.
4. Whether proposal review clearly distinguishes accepted, proposed, and evidence state.
5. Whether backup, destructive reset, quota recovery, and local-photo deletion language is understandable.
6. Whether Roblox Classic limitations are prominent without overwhelming the main flow.
7. Which GUI choices Mark or David should be able to vary through presentation configuration.
8. Which future seams belong in the final specification without entering this release scope.

## Non-negotiable constraints

The final specification must not silently weaken these constraints:

- No required photo, account, remote AI, telemetry, or network dependency.
- No photo bytes, blob keys, pixel digests, focus regions, or analyzer-private state in `StudioViewModel` or exported backups.
- No remote photo transmission in the current foundation.
- No generated artifact becomes downloadable until its platform preflight passes.
- A platform compiler failure cannot corrupt the identity, recipe, storage, or other platform output.
- IndexedDB failure must leave immediate editing and export usable in memory.
- Destructive restore is separately confirmed, transactional, and limited to a pristine post-loss library; ordinary foreign import remains rejected.
- App-shell caching is an exact public allowlist and excludes photos, IndexedDB data, generated artifacts, tests, and private docs.
- “Works without WebGL” means exact 2D preview and both exports remain available.
- No push, deployment, publication, Roblox mutation, purchase, or external rename is authorized by these documents.

## Evidence and known limits

The automated suite, syntax checks, shell validation, privacy scans, and diff checks are the implementation evidence. Exact current counts should be read from the latest verification output or rerun with `npm test` rather than copied into the final spec as a permanent number.

The browser matrix intentionally distinguishes observed evidence from pending evidence. Mobile/touch, reduced motion, request interception, Cache Storage/offline toggling, camera denial, file-picker capture, destructive confirmation, and full accessibility-tree observation still require a capable release environment. Fable should preserve these as release gates, not reinterpret them as completed.

## Requested Fable deliverable

Produce one final product specification that:

1. States the product promise and target users.
2. Defines the canonical vocabulary and cross-game domain model.
3. Defines routes, screen states, navigation, empty/loading/error/recovery states, and interaction choreography.
4. Includes desktop and mobile wireframes or precise annotated layouts.
5. Defines accessibility behavior and child/family privacy language.
6. Preserves the hard dependency boundaries in the [code map](FABLE_CODEMAP.md).
7. Separates release scope, future attachment seams, and explicitly excluded work.
8. Includes acceptance criteria and the complete release verification matrix.
9. Marks any proposed change that conflicts with implemented contracts as a migration or design amendment.
10. Records GUI decisions that Mark or David may revisit without reopening the domain architecture.

Suggested output path: `docs/MY_AVATARS_FINAL_PRODUCT_SPEC.md`

## Historical material

These documents are useful design evidence but are not current authority:

- [Sol Ultra final design review](reviews/sol-ultra-final-design-review.md) — detailed screen-by-screen mobile exploration.
- [Gemini mobile UI review](reviews/gemini-mobile-ui-review.md) — alternative GUI concepts and risks.
- [Multi-LLM architecture review](reviews/multi-llm-architecture-review.md) — earlier architecture critique.
- [Mobile Avatar Studio design](superpowers/specs/2026-07-10-mobile-avatar-studio-design.md) — superseded Skin Forge design.
- [Minecraft Skin Forge design](superpowers/specs/2026-07-09-minecraft-skin-forge-design.md) — superseded Minecraft-only design.

When historical material conflicts with the Final Solution or the 2026-07-11 cross-game design, the current documents win.
