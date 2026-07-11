# My Avatars Cross-Game Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Minecraft-only Skin Forge prototype with the approved local-first My Avatars foundation, producing deterministic Minecraft and Roblox Classic artifacts from one semantic identity while keeping normalized photos private and optional.

**Architecture:** Pure ES modules own contracts, the avatar kernel, analyzers, and platform compilers. An injected IndexedDB repository owns one person's local library; `StudioSession` is the only facade used by presentation. Browser-only adapters encode images, normalize photos, download artifacts, register an allowlist-only service worker, and lazy-load the optional Three.js viewer.

**Tech Stack:** Static HTML/CSS, browser ES modules, Canvas and IndexedDB, Web Crypto, native `node:test`, `fake-indexeddb` for storage tests, self-contained deterministic PNG/ZIP encoders, optional self-hosted Three.js.

**Normative design:** `docs/superpowers/specs/2026-07-11-my-avatars-cross-game-foundation-design.md` controls all value shapes, privacy invariants, algorithms, routes, platform maps, and recovery behavior. If code would require changing one of those contracts, stop and amend the design first.

---

## Locked file map

```text
index.html                         semantic shell and stable controls
styles.css                        Block Adventure tokens and responsive layout
app.js                            bootstrap, dependency construction, route mount only
viewer.js                         optional self-hosted Minecraft viewer adapter
package.json                      ESM metadata and bounded test scripts
manifest.webmanifest              /my-avatars/ install metadata
sw.js                             allowlist-only app-shell service worker
presentation-config.v1.json       checked-in GUI-safe configuration
presentation-config.schema.v1.json
compat/minecraft/index.html       local old-path redirect fixture
deploy/pages-allowlist.txt        exact public artifact inputs
deploy/rename-and-pages-runbook.md

src/domain/result.js
src/domain/canonical-json.js
src/domain/digest.js
src/domain/contracts.js
src/domain/defaults.js
src/avatar-kernel/kernel.js
src/avatar-kernel/projection.js
src/compilers/minecraft/layout-v1.js
src/compilers/minecraft/painter.js
src/compilers/minecraft/compiler.js
src/compilers/minecraft/png.js
src/compilers/roblox-classic/template-v1.js
src/compilers/roblox-classic/painter.js
src/compilers/roblox-classic/compiler.js
src/compilers/roblox-classic/package.js
src/identity-library/database.js
src/identity-library/repository.js
src/identity-library/backup.js
src/identity-library/photo-normalizer.js
src/identity-analyzer/palette-analyzer-v1.js
src/studio-session/memory-library.js
src/studio-session/studio-session.js
src/studio-session/view-model.js
src/routing/resolve-route.js
src/presentation/config.js
src/presentation/shell.js
src/experimental/capture-route.js
src/pwa/app-shell.js
src/pwa/register-service-worker.js

tests/unit/*.test.js              pure contract/kernel/compiler/router/analyzer tests
tests/integration/*.test.js       storage/session/isolation tests
tests/support/fake-indexeddb.js   dev dependency adapter only
tests/support/static-server.mjs   serves repository at /my-avatars/
tests/fixtures/*                  synthetic records and decoded RGBA goldens only
tests/browser/scenarios.md        proxy-driven evidence checklist
```

Dependency direction is fixed: presentation and routes call `StudioSession`; the session calls injected kernel/library/compiler interfaces; the experimental route alone imports normalization/analyzer code; compilers receive only `AppearanceSnapshotV1`; the optional viewer receives only the compiled Minecraft texture. No dependable module imports `src/experimental/` or a remote URL.

## Task 1: Harness and executable contracts

**Files:** create `package.json`, `src/domain/result.js`, `src/domain/canonical-json.js`, `src/domain/digest.js`, `src/domain/contracts.js`, `src/domain/defaults.js`, `tests/unit/contracts.test.js`, `tests/unit/canonical-json.test.js`.

- [ ] Write failing tests that import `ok`, `err`, `canonicalJson`, `validateIdentity`, `validateRecipe`, `validateProvenance`, `createDefaultIdentity`, and `createDefaultRecipe`. Assert the exact provenance combinations from design section 8.1, lowercase color validation, unknown-key rejection, stable recursive key ordering, deeply frozen defaults, label `Avatar 1`, revision `1`, and absence of `photo`, `blob`, `mask`, and `embedding` keys.
- [ ] Run `node --test tests/unit/contracts.test.js tests/unit/canonical-json.test.js`; expect `ERR_MODULE_NOT_FOUND` for `src/domain/contracts.js`.
- [ ] Add `package.json` with name `my-avatars`, `private: true`, `type: module`, engines `node >=22`, and scripts `test: node --test`, `test:unit: node --test tests/unit`, `test:integration: node --test tests/integration`, `serve:test: node tests/support/static-server.mjs --port 8000`. Add `fake-indexeddb` as the only development dependency.
- [ ] Implement `ok(value) => { ok: true, value }` and `err(fault) => { ok: false, fault }`; canonical JSON recursively sorts object keys, preserves array order, rejects unsupported values, and UTF-8 digests through injected or global `crypto.subtle`.
- [ ] Implement closed runtime validators and defaults exactly matching design sections 8 and 8.1. Validators return `Result` faults with `{ kind, path, message }`; they never coerce or drop input.
- [ ] Run the focused tests, then `npm test`; expect all discovered tests to pass with zero warnings.
- [ ] Commit as `feat: add My Avatars domain contracts`.

## Task 2: Pure avatar kernel

**Depends on:** Task 1.

**Files:** create `src/avatar-kernel/projection.js`, `src/avatar-kernel/kernel.js`, `tests/unit/avatar-kernel.test.js`, `tests/unit/snapshot.test.js`.

- [ ] Write failing tests for `createAvatarKernel().start()`, `transact({ frame, baseRevision, operations })`, and `snapshot(frame)`. Cover default start, invalid seed, one revision increment per successful transaction, stale base revision, closed operation allowlist, input immutability, and selected proposal field application.
- [ ] Assert snapshots contain `{ schemaVersion, recipeId, recipeRevision, identityRevision, semanticAppearance, sourceDigest }`, use accepted identity plus recipe style, are deeply frozen, validate canonically, and contain no provenance, photo IDs, blob keys, focus regions, analyzer versions, or biometric data.
- [ ] Run `node --test tests/unit/avatar-kernel.test.js tests/unit/snapshot.test.js`; expect missing-module failures.
- [ ] Implement a stateless kernel. `start(seed)` validates either the complete seed or the pinned defaults. `transact` validates the supplied frame before checking `baseRevision`, applies operations to clones, increments affected revisions once, validates the result, and returns `err` without mutation on any failure. `snapshot` projects only semantic appearance and hashes its canonical source record.
- [ ] Run the focused tests and `npm test`; expect pass.
- [ ] Commit as `feat: add deterministic avatar kernel`.

## Task 3: Minecraft compiler tracer bullet

**Depends on:** Task 2.

**Files:** create `src/compilers/minecraft/layout-v1.js`, `painter.js`, `compiler.js`, `png.js`, `tests/unit/minecraft-compiler.test.js`, `tests/unit/minecraft-validator.test.js`, synthetic decoded RGBA fixtures under `tests/fixtures/minecraft/`.

- [ ] Write failing tests for `compile({ snapshot, profile })` and `preflight(bundle)`. Assert 64 x 64 RGBA, transparent unused pixels, independent left/right limbs, Classic four-pixel and Slim three-pixel arm regions, nonempty required faces, hair only on the hat layer, aligned outer clothing, filename `my-avatar-minecraft.png`, compiler `minecraft-v1`, and stable pixel digest.
- [ ] Add a parity test proving the compiler's decoded RGBA buffer is the single source for both exact 2D preview and PNG encoding; decode the produced PNG and byte-compare all 16,384 RGBA bytes.
- [ ] Run `node --test tests/unit/minecraft-compiler.test.js tests/unit/minecraft-validator.test.js`; expect missing-module failures.
- [ ] Extract and centralize the modern 64 x 64 layout from the legacy painter and viewer. Implement painting solely from semantic colors and styles—never photo pixels. The PNG encoder writes deterministic non-interlaced RGBA PNG bytes with fixed filter policy and no metadata chunks.
- [ ] Run focused tests and `npm test`; expect pass.
- [ ] Commit as `feat: add Minecraft avatar compiler`.

## Task 4: Dependable session, routing, and no-photo Block Adventure UI

**Depends on:** Tasks 1–3.

**Files:** create `src/studio-session/memory-library.js`, `studio-session.js`, `view-model.js`, `src/routing/resolve-route.js`, `src/presentation/config.js`, `shell.js`, both presentation JSON files, and tests `tests/unit/route-resolution.test.js`, `view-model.test.js`, `tests/integration/studio-session.test.js`; replace `index.html`, `styles.css`, and `app.js`.

- [ ] Write failing route tests for all five public hashes, exact three compatibility hashes, and unknown/empty fallback to `#/studio` with a non-mutating accessible notice. Import the route resolver with an intentionally unavailable experimental module and prove dependable resolution still works.
- [ ] Write failing session tests for start without photos/storage/network/viewer, semantic edits, save/select multiple looks, stale dispatch rejection, Minecraft compilation, compiler fault isolation, announcements, and deeply frozen `StudioViewModelV1` with no blob/digest exposure.
- [ ] Write config tests that accept only schema version 1, enumerated layout variants, approved token/label/order keys, and immutable fallback. Assert config cannot hide privacy, deletion, validation, export, or accessibility controls.
- [ ] Run the three focused test files; expect missing-module failures.
- [ ] Implement `StudioSession` as the sole mutable coordinator with `dispatch`, `subscribe`, `getViewModel`, and `dispose`. Implement only the closed actions in design section 7.7. Use revision tokens to discard stale async compiler results and revoke superseded object URLs.
- [ ] Replace the document with stable navigation, stage, semantic controls, results, notices, and dialogs. Preserve relevant legacy IDs; rename `skin-canvas` to `minecraft-texture-canvas` and download to `my-avatar-minecraft.png`. Single click selects without toggling off; double click/tap invokes the same Continue action; arrows/Space select and Enter continues.
- [ ] Implement Block Adventure tokens: navy/violet surfaces, mint/cool-blue actions, visible focus, non-color state cues, 44px minimum mobile targets, reduced motion, semantic landmarks, ordered headings, and live announcements.
- [ ] Run focused tests, `npm test`, and `node --check app.js`; expect pass.
- [ ] Commit as `feat: add dependable My Avatars studio`.

## Task 5: One-person IndexedDB library, migrations, deletion, and backup

**Depends on:** Tasks 1, 2, and the session interface from Task 4.

**Files:** create `src/identity-library/database.js`, `repository.js`, `backup.js`, `tests/support/fake-indexeddb.js`, and integration tests `identity-library.test.js`, `migrations.test.js`, `deletion.test.js`, `backup.test.js` with synthetic migration fixtures.

- [ ] Write failing tests for database `my-avatars` and stores `meta`, `photos`, `identities`, `recipes`, `drafts`, `artifacts`; one lineage; multiple recipes; revision conflicts; injected quota failure; unavailable IndexedDB fallback; and transaction abort preserving old state.
- [ ] Write failing tests for the full-store transactional reset protocol, photo deletion cascade, all-photo deletion, look deletion, and full library deletion. Assert deleted accepted provenance becomes empty-ID `deleted`, while pending proposals/drafts/artifacts disappear.
- [ ] Write failing canonical-backup tests for the exact version-1 shape, provenance sanitization, foreign non-empty rejection, empty restore, matching-ID confirmed replacement that clears photos, and invalid input with zero mutation.
- [ ] Write failing migration tests for transaction rollback and `meta` migration backup removal only after validation.
- [ ] Run `node --test tests/integration/identity-library.test.js tests/integration/migrations.test.js tests/integration/deletion.test.js tests/integration/backup.test.js`; expect missing-module failures.
- [ ] Implement every repository write as one explicit transaction over all affected stores. Map DOMException quota errors to a typed quota fault without automatic deletion. Inject `indexedDB`, `navigator.storage.estimate`, clock, and ID creation.
- [ ] Run storage tests and `npm test`; expect pass.
- [ ] Commit as `feat: add private identity library`.

## Task 6: Normalized photo and bounded palette proposals

**Depends on:** Tasks 1, 2, 4, and 5.

**Files:** create `src/identity-library/photo-normalizer.js`, `src/identity-analyzer/palette-analyzer-v1.js`, `src/experimental/capture-route.js`, `tests/unit/photo-normalizer-policy.test.js`, `palette-analyzer.test.js`, `tests/integration/proposal-flow.test.js`.

- [ ] Write failing pure analyzer tests using synthetic 32 x 32 RGBA arrays. Assert exact role zones, 16-value midpoint quantization, tie-break, shadow/highlight math, every warning threshold, confidence bands, allowed operations only, and explicit base identity revision.
- [ ] Write browser-adapter policy tests with injected decode/canvas/URL functions. Assert 2048 longest edge, JPEG 0.92, alpha PNG, normalized digest, confirmed focus region, persistence only after role confirmation, and cleanup on success/cancel/decode/encode/store failure.
- [ ] Write proposal-flow tests for preview, reject with no mutation, selected acceptance, low-confidence no preselection, manual correction, stale revision rejection, and analyzer failure isolation.
- [ ] Run the three focused tests; expect missing-module failures.
- [ ] Implement normalization without retaining original filename/path/bytes or decoded buffers. Persist no thumbnail, mask, landmark, or analyzer-private state. Implement the analyzer exactly as design section 7.2; it returns proposals and never writes storage.
- [ ] Lazy-import `capture-route.js` only for `#/experimental/capture`; camera denial preserves upload/default/manual paths.
- [ ] Run focused tests and `npm test`; expect pass.
- [ ] Commit as `feat: add private palette capture flow`.

## Task 7: Roblox Classic compiler and deterministic My Avatars package

**Depends on:** Tasks 1 and 2. May run parallel to Tasks 5–6 after contracts freeze.

**Files:** create `src/compilers/roblox-classic/template-v1.js`, `painter.js`, `compiler.js`, `package.js`, `tests/unit/roblox-template.test.js`, `roblox-compiler.test.js`, synthetic fixtures under `tests/fixtures/roblox/`.

- [ ] Write failing template tests for the pinned URL/date/commit/hashes, 585 x 559 dimensions, and every exact half-open rectangle from design section 12. Assert no rectangle exceeds bounds and the product/documented rule provenance is explicit.
- [ ] Write failing compiler tests for transparent outside pixels, nonempty shirt/arm and pants/leg regions, deterministic decoded RGBA/pixel digests, package filenames, manifest fields, `externalStatus: 'not-submitted'`, photo/provenance exclusion, and local preflight failure blocking only Roblox download.
- [ ] Write failing package tests that parse the deterministic ZIP and byte-compare `my-avatar-roblox-shirt.png`, `my-avatar-roblox-pants.png`, `manifest.json`, and `README.txt`. Assert prohibited acceptance/equipping/free-publication claims and credentials are absent, while all seven manual-workflow limitations are present.
- [ ] Run `node --test tests/unit/roblox-template.test.js tests/unit/roblox-compiler.test.js`; expect missing-module failures.
- [ ] Implement transparent numeric-map painters, deterministic PNG encoding reuse, local preflight, canonical manifest, fixed README text, CRC-32, and an uncompressed deterministic ZIP with sorted entries and fixed DOS timestamp. Do not check in or redistribute Roblox template media.
- [ ] Run focused tests and `npm test`; expect pass.
- [ ] Commit as `feat: add Roblox Classic export package`.

## Task 8: PWA, optional viewer, redirect fixture, and deployment safety

**Depends on:** Tasks 3, 4, and 7; add the service worker only after the final shell list is stable.

**Files:** create `src/pwa/app-shell.js`, `register-service-worker.js`, `manifest.webmanifest`, `sw.js`, `compat/minecraft/index.html`, `deploy/pages-allowlist.txt`, `deploy/rename-and-pages-runbook.md`, tests `service-worker-policy.test.js`, `redirect-page.test.js`; modify `viewer.js`, `.github/workflows/deploy-pages.yml`, `README.md`, current authoritative docs.

- [ ] Write failing policy tests for a versioned exact public allowlist, complete install before cache promotion, previous-cache preservation on install failure, user-controlled waiting-worker activation, and bypass of blob/data/download/generated/workshop/authenticated/non-allowlisted requests. Assert no service-worker path opens or deletes IndexedDB.
- [ ] Write failing redirect tests: the three known hashes map to their new exact hashes; missing/unknown maps to `/my-avatars/#/studio`; all query parameters are dropped.
- [ ] Write failing deployment tests that every staged public path is explicitly allowlisted and `face-comparison.html`, personal images, generated artifacts, screenshots, tests, and private docs are excluded.
- [ ] Run route/PWA tests; expect missing-module or assertion failures.
- [ ] Rename viewer API to `createMinecraftAvatarViewer` and `updateMinecraftTexture`, self-host critical modules, and lazy-import only after exact 2D preview exists. Catch import/WebGL errors as accessible nonblocking notices.
- [ ] Implement the service worker and manifest for scope/start URL `/my-avatars/`. Assemble Pages artifacts from `deploy/pages-allowlist.txt` into a temporary staging directory in CI; never upload repository root.
- [ ] Add the local compatibility fixture and remote rename/Pages/scope/canonical/redirect/rollback runbook. Do not push, rename the remote, change Pages, deploy, or publish.
- [ ] Run focused tests, `npm test`, and syntax checks for every JavaScript file; expect pass.
- [ ] Commit as `feat: add offline and deployment safeguards`.

## Task 9: Integration, browser evidence, and final audit

**Depends on:** all prior tasks. One integration owner only.

**Files:** create `tests/integration/compiler-isolation.test.js`, update `tests/browser/scenarios.md`, current docs, and any failing implementation files within their existing contracts.

- [ ] Write the compiler-isolation test first: force either compiler to fail and prove the recipe, other compiler, and storage remain usable.
- [ ] Run it red, implement only missing isolation handling, then run it green.
- [ ] Run `npm test`; require zero failures and zero warnings.
- [ ] Serve with `npm run serve:test`, then use the shared browser proxy to execute every scenario in design section 19.3 on mobile and desktop. Record date, browser, route, observed result, and artifact digest in `tests/browser/scenarios.md`; do not check in photos or screenshots containing private data.
- [ ] Inspect both downloaded formats: decoded Minecraft pixels equal preview pixels; Roblox ZIP contains exactly four files and passes local preflight. Exercise Classic/Slim, offline reload, camera denial, WebGL failure, quota/migration failure, proposal accept/reject, deletion, focus, reduced motion, and accessible announcements.
- [ ] Intercept requests and Cache Storage; record that normalized photo bytes, blob URLs, generated artifacts, IndexedDB records, authenticated requests, and `/workshop/` are absent.
- [ ] Run `rg -n "Skin Forge|skin forge|generateSkin|createSkinViewer|minecraft-skin\.png|0\.9327|unpkg\.com|fonts\.googleapis\.com" --glob '!docs/PROJECT_HISTORY.md' --glob '!docs/reviews/**' --glob '!docs/superpowers/plans/2026-07-09-*' .`; allow only explicit historical/compatibility statements.
- [ ] Run `git status --short`, `git diff --check`, the full test suite, all JS syntax checks, and a staged-path privacy audit. Verify no personal/generated artifact is staged.
- [ ] Request spec-compliance review, then code-quality review, fix every Critical/Important issue, rerun both reviews, and perform a final privacy/migration/release audit.
- [ ] Commit as `test: verify My Avatars foundation`.

## Parallel execution graph and model sizing

```text
Task 1 contracts -> Task 2 kernel -> Task 3 Minecraft -> Task 4 session/UI
                         |                 |                 |
                         +-> Task 7 Roblox +-----------------+
                                           Task 5 storage -> Task 6 photos
Task 3 + Task 4 + Task 7 -> Task 8 PWA/deployment -> Task 9 integration
```

- Use Luna low/medium for isolated modules and fixtures after Task 1.
- Use Terra medium/high for Tasks 4, 8, integration, and debugging across boundaries.
- Use Sol high/xhigh only for contract amendments, storage/privacy review, and final audit.
- Any worker stops if it needs a new enum, field, privacy behavior, migration protocol, Roblox coordinate, runtime dependency, or cross-file API not declared here or in the design.
