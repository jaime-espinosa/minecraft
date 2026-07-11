# My Avatars Cross-Game Foundation Design

Date: 2026-07-11

Status: Approved for autonomous local implementation on 2026-07-11. Deployment, push, publication, purchases, Roblox uploads, and other external mutations remain blocked without separate authorization.

## 1. Authority and Relationship to Existing Documents

This approved design is the normative amendment to `docs/FINAL_SOLUTION.md` for the product identity and the first cross-game delivery boundary. It replaces **Skin Forge** with **My Avatars** throughout local source, product copy, storage, documentation, deployment artifacts, and internal application vocabulary.

This design supersedes the `docs/FINAL_SOLUTION.md` persistence rule that stores recipes and metadata but not uploaded photos only as follows: IndexedDB may retain a **Normalized Source Photo** after the user explicitly confirms its role. Original file bytes, filenames, paths, and metadata are never persisted. `docs/PRIVACY_AND_SAFETY.md`, `docs/OPERATIONS.md`, and `docs/TESTING_AND_RELEASE.md` continue to control wherever this amendment is silent.

This design does not weaken the local-photo boundary, deterministic rendering requirements, child-safety controls, or Workshop restrictions.

The implementation plan produced from this design covers only the cross-game avatar foundation described here. Roblox experience assets and Roblox wearable/layered 3D assets are separate follow-on specifications.

## 2. Objective

Build **My Avatars**, a local-first avatar studio where one person can:

1. Start from a polished, editable avatar without supplying a photo.
2. Progressively add face, hair, outfit, or angle photos to a private local library.
3. Review and accept semantic appearance changes proposed from those photos.
4. Save multiple looks derived from one identity.
5. Export a native Minecraft avatar texture or a My Avatars package containing Roblox Classic shirt and pants image candidates from the same semantic identity.

The product promise is **semantic identity continuity**, not literal geometry or pixel equality across games. Hair silhouette, complexion palette, expression cues, outfit story, and selected accessories should remain recognizable while each renderer obeys its target platform.

## 3. Product Name and Vocabulary

### 3.1 Canonical terms

| Canonical term | Meaning |
| --- | --- |
| My Avatars | Product and repository identity |
| Identity Library | Device-local source photos, derived identity profile, and saved looks for one person |
| Normalized Source Photo | A normalized, metadata-free local visual reference retained in the Identity Library after explicit role confirmation |
| Identity Profile | Platform-neutral semantic appearance data derived from defaults, manual choices, and accepted photo analysis |
| Avatar Recipe | One editable saved look derived from an Identity Profile |
| Appearance Snapshot | Immutable renderer input containing no photos, face embeddings, masks, or platform asset IDs |
| Platform Profile | Bounded target-specific choices, such as Minecraft Classic/Slim geometry |
| Compiler | Deterministic platform adapter that creates and validates downloadable artifacts |
| Proposed Change | An analyzer suggestion that cannot mutate accepted identity data until the user approves it |

### 3.2 Use of “skin”

The word `skin` is reserved for compatibility language at Minecraft boundaries, such as “Minecraft skin format,” “import this skin into Minecraft,” or a standards-facing type such as `MinecraftSkinLayout`. My Avatars-owned concepts use `avatar`, `identity`, `look`, `recipe`, `texture`, `complexion`, or `artifact`.

The product must not use “skin” as its brand, generic studio noun, repository name, database name, or cross-game domain abstraction.

## 4. Scope

### 4.1 Included in this design

1. Full local product, source, package, documentation, and repository-artifact rename to My Avatars; remote repository and deployment mutation remain separately authorized operations.
2. Block Adventure visual direction.
3. One-person device-local Identity Library.
4. Multiple saved Avatar Recipes for that person.
5. Progressive, optional photo capture and import.
6. Retention of Normalized Source Photos in IndexedDB.
7. Proposal, preview, acceptance, rejection, and manual correction of analyzed traits.
8. A deterministic platform-neutral kernel.
9. Minecraft Classic and Slim compilation.
10. Roblox Classic shirt and pants image-candidate compilation.
11. Exact 2D preview and local downloads.
12. Optional, lazy 3D preview that cannot block editing or export.
13. Installable, offline-capable PWA behavior with self-hosted critical assets.
14. Transactional local migrations, deletion, and recovery.
15. A constrained presentation seam for GUI development.
16. Tests, fixtures, browser evidence, redirects, rollback, and release gates.

### 4.2 Explicitly excluded

1. Roblox layered clothing, rigid wearable publishing, custom bodies, dynamic heads, or photo-to-3D likeness.
2. Roblox experience weapons, Tools, props, vehicles, furniture, or gameplay scripting.
3. Automatic Roblox login, upload, equip, Marketplace submission, Creator Store submission, or publication.
4. Catalog purchases or automatic matching to paid Roblox assets.
5. Cloud photo storage, accounts, household identity syncing, or cross-device photo transfer.
6. Remote generative inference.
7. Prompt-to-code, prompt-to-Luau, or unrestricted Workshop patches.
8. Telemetry until all existing child-privacy gates pass.
9. Claims of proven person-level likeness before an independent fidelity gate passes.

## 5. Program Decomposition

My Avatars is a program with three separately specified deliverables:

1. **Cross-game avatar foundation** — this design: Identity Library, semantic recipe, Minecraft, and Roblox Classic.
2. **Roblox Experience Asset Workshop** — future: static props first, then visual Tool wrapping, then fixed audited behaviors.
3. **Roblox Wearable and Layered 3D** — future: rigid accessory spike, layered top spike, and only then broader garment or body work.

The future object pipeline uses a separate `ObjectRecipe`; it must not consume personal photos, `AvatarRecipe`, or biometric data. It may copy an explicit non-biometric style snapshot containing approved colors, patterns, and finishes. Future wearable compilers may consume `AppearanceSnapshot` plus a separately approved wearable profile.

## 6. Architectural Choice

### 6.1 Selected approach

Use a **shared semantic core with native platform compilers**.

```text
Normalized Source Photos
          |
          v
Experimental Analyzer ----> Proposed Changes
                                  |
                           preview / accept
                                  |
                                  v
Identity Profile ----> Avatar Recipe ----> Appearance Snapshot
                                              |          |
                                              v          v
                                    Minecraft Compiler  Roblox Classic Compiler
                                              |          |
                                              v          v
                                      PNG + validation  My Avatars ZIP + local preflight
```

The common domain never stores Minecraft UV coordinates, Roblox template coordinates, platform asset IDs, cages, meshes, or publishing state. Each compiler owns its target format.

### 6.2 Rejected approaches

1. **Minecraft as the canonical source:** rejected because a 64 x 64 UV sheet discards semantic appearance information and spreads Minecraft constraints into Roblox.
2. **Independent studio per game:** rejected because it duplicates photo handling, editing, storage, migration, and identity decisions and breaks the “one photo set, any supported game” promise.

## 7. Module Boundaries

### 7.1 `identity-library`

Owns IndexedDB access, schema versions, normalized Source Photo blobs, identity records, recipes, transactional migrations, quota handling, deletion, and recovery.

Public responsibilities:

- Open or create the one-person library.
- Store and retrieve Normalized Source Photos by opaque ID.
- Commit accepted Identity Profile revisions.
- Store multiple Avatar Recipes and their active revisions.
- Export and import photo-free library backups.
- Delete individual photos, all photos, one look, or the entire library.

It does not analyze photos, render assets, update DOM, call a network service, or know game formats.

### 7.2 `identity-analyzer`

Spec 1 includes one bounded `PaletteAnalyzerV1` in the isolated experimental capture route. It supports `face-front`, `hair-detail`, `outfit-front`, and `outfit-detail` roles and may propose only complexion, hair, top, bottom, and footwear palette operations. It does not infer face geometry, hair geometry, expression, body shape, accessories, age, identity, or person-level likeness.

`FaceDetector`, when available, may suggest a crop center only. Manual crop controls remain authoritative and portable.

The analyzer receives decoded local pixels and a user-confirmed crop or highlight. It returns `ProposedIdentityChange` records with evidence, warnings, analyzer version, and evidence-quality bands. Its warning taxonomy is fixed to `blur`, `low-light`, `overexposure`, `low-coverage`, `background-risk`, and `face-detector-unavailable`.

It never writes the Identity Library directly. Numeric scores are analyzer-specific and are not compared across analyzers. `PaletteAnalyzerV1` maps its pinned, fixture-tested checks to `high`, `review`, or `low`:

- `high`: may be preselected in the preview but still requires acceptance.
- `review`: displayed with warnings and manual alternatives.
- `low`: never preselected and cannot replace an accepted ingredient without an explicit manual choice.

`PaletteAnalyzerV1` consumes an already normalized RGBA image plus the persisted focus region. It resamples that square to 32 x 32 pixels, ignores pixels with alpha below 230, and quantizes each remaining channel to the midpoint of a 16-value bucket. `face-front` and `hair-detail` use the centered ellipse with radii `0.42w` and `0.46h`; outfit roles use the full focus square and propose top from normalized rows `[0.05, 0.45)`, bottom from `[0.45, 0.82)`, and footwear from `[0.82, 1]`. For each field, the most frequent quantized bucket is `primary`; `shadow` multiplies each channel by `0.72` and `highlight` blends each channel `0.18` toward 255, with round-to-nearest and clamp to `[0, 255]`.

Warnings are deterministic: `low-coverage` when fewer than 60% of candidate samples survive; `low-light` when median Rec. 709 luma is below 50; `overexposure` when more than 20% of samples have luma above 245; `blur` when the mean absolute horizontal-and-vertical luma delta is below 4; `background-risk` when one border bucket exceeds 35% of border samples and equals the proposed primary bucket; and `face-detector-unavailable` only when the role is `face-front` and the injected crop-suggestion capability reports unavailable. Confidence is `high` only with coverage at least 80% and no warnings, `review` with coverage at least 60% and no more than two warnings other than `low-coverage`, and `low` otherwise. Equal-frequency buckets use ascending RGB integer order as the tie-breaker.

### 7.3 `avatar-kernel`

Pure, deterministic domain module. It validates seeds and operations, applies transactions against a base revision, creates immutable Appearance Snapshots, and returns typed faults.

It has no DOM, IndexedDB, camera, network, image decoder, Three.js, or platform-template dependency.

### 7.4 `minecraft-compiler`

Owns the modern Minecraft 64 x 64 RGBA layout, Classic/Slim rules, UV regions, outer layers, validation, artifact naming, and exact 2D preview data.

### 7.5 `roblox-classic-compiler`

Owns versioned Roblox Classic shirt and pants layouts, template-specific local preflight, manifest generation, My Avatars ZIP packaging, and import instructions.

It does not create hair geometry, accessories, layered clothing, bodies, asset IDs, or executable code. Roblox moderation and acceptance remain external.

### 7.6 `studio-session`

Application facade that coordinates the kernel, library, accepted proposals, history, drafts, preview state, downloads, accessible announcements, and typed recovery flows.

View modules interact with `StudioSession`; they do not call storage or compilers directly.

### 7.7 `presentation`

Consumes a stable `StudioViewModel`. It owns semantic HTML, stable control IDs, Block Adventure CSS tokens, responsive layout, accessibility, dialogs, and route views.

The presentation seam supports GUI work through:

- Source-controlled view components.
- CSS custom properties.
- A source-controlled `presentation-config.v1.json` file validated at startup against a checked-in versioned schema.
- Validated theme tokens.
- Enumerated layout variants.
- Schema-validated labels, ordering, and feature visibility.

Invalid or missing presentation configuration falls back to a checked-in immutable default. Configuration cannot hide privacy controls, validation failures, deletion, exports, or accessibility features.

Spec 1 performs no Workshop fetch, publication, authentication, or remote-configuration work. The presentation layer does not accept arbitrary HTML, CSS, JavaScript, prompts-as-code, or unrestricted patches at runtime. Presentation changes cannot bypass identity validation, privacy, persistence, compilers, or release gates.

The stable `StudioViewModelV1` is a deeply frozen object with `{ route, navigation, identityRevision, activeRecipe, recipes, editor, proposal, previews, exports, library, busy, fault, announcement }`. `navigation` contains the five public routes; `editor` contains only semantic controls; `proposal` is `null` or the current proposed operations and warnings; `previews` contains transient artifact URLs but no photos; `library` contains photo IDs, roles, dimensions, and created timestamps but no blobs or digests. The closed presentation action vocabulary is `navigate`, `edit`, `save-look`, `select-look`, `delete-look`, `request-reset-person`, `confirm-reset-person`, `add-photo`, `delete-photo`, `delete-all-photos`, `analyze`, `accept-proposal`, `reject-proposal`, `compile-minecraft`, `compile-roblox-classic`, `download`, `reload-update`, and `dismiss-fault`.

Choice controls are single-selection controls: clicking selects but never toggles the selected choice off. Double-clicking or double-tapping a choice selects it and activates the same bounded Continue action as the visible Continue button. Keyboard users select with arrows or Space and activate Continue with Enter. No double-click-only path is allowed.

## 8. Domain Contracts

The implementation plan must preserve these contracts. A type may be split across files for readability, but field meanings, privacy exclusions, revision semantics, and dependency direction are normative. Any incompatible contract change requires a documented design amendment before implementation continues.

```ts
type PhotoRole =
  | 'face-front'
  | 'face-smile'
  | 'face-left'
  | 'face-right'
  | 'hair-detail'
  | 'outfit-front'
  | 'outfit-detail'
  | 'other';

type SourcePhotoV1 = {
  id: string;
  role: PhotoRole;
  blobKey: string;
  pixelDigest: string;
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  createdAt: string;
  normalizationVersion: string;
  focusRegion: { centerX: number; centerY: number; size: number };
};

type FieldProvenanceV1 = {
  source: 'default' | 'manual' | 'photo-analysis';
  sourcePhotoIds: readonly string[];
  evidenceState: 'available' | 'deleted' | 'not-applicable';
  analyzerVersion?: string;
  confidence?: 'high' | 'review' | 'low';
};

type IdentityProfileV1 = {
  schemaVersion: 1;
  revision: number;
  complexionPalette: SemanticPalette;
  hair: SemanticHair;
  face: SemanticFace;
  outfit: SemanticOutfit;
  accessories: readonly SemanticAccessory[];
  provenance: Readonly<Record<string, FieldProvenanceV1>>;
};

type AvatarRecipeV1 = {
  schemaVersion: 1;
  id: string;
  revision: number;
  localLabel: string;
  identityRevision: number;
  style: AvatarStyleV1;
  platformProfiles: {
    minecraft: MinecraftProfileV1;
    robloxClassic: RobloxClassicProfileV1;
  };
};

type AppearanceSnapshotV1 = {
  schemaVersion: 1;
  recipeId: string;
  recipeRevision: number;
  identityRevision: number;
  semanticAppearance: SemanticAppearanceV1;
  sourceDigest: string;
};

type ProposedIdentityChangeV1 = {
  id: string;
  baseIdentityRevision: number;
  operations: readonly IdentityOperation[];
  evidencePhotoIds: readonly string[];
  analyzerVersion: string;
  confidence: 'high' | 'review' | 'low';
  warnings: readonly AnalyzerWarning[];
};

interface AvatarKernel {
  start(seed?: unknown): Result<AvatarFrame, RecipeFault>;
  transact(input: {
    frame: AvatarFrame;
    baseRevision: number;
    operations: readonly AvatarOperation[];
  }): Result<AvatarFrame, AvatarFault>;
  snapshot(frame: AvatarFrame): AppearanceSnapshotV1;
}

interface PlatformCompiler<TProfile> {
  compile(input: {
    snapshot: AppearanceSnapshotV1;
    profile: TProfile;
  }): Result<ArtifactBundleV1, CompilerFault>;
  preflight(bundle: ArtifactBundleV1): LocalPreflightReportV1;
}
```

Normalized Source Photos and biometric embeddings are forbidden in `IdentityProfile`, `AvatarRecipe`, `AppearanceSnapshot`, compiler inputs, manifests, and downloadable artifacts. The system does not create or retain reusable face-recognition embeddings.

### 8.1 Concrete Spec 1 value contracts

All colors serialize as lowercase six-digit sRGB hex strings matching `^#[0-9a-f]{6}$`. Lists serialize in their declared order; object digests use recursively sorted keys and UTF-8 JSON with no insignificant whitespace. Unknown keys, non-finite numbers, and unsupported enum values are validation faults rather than silently ignored input.

```ts
type SemanticPalette = { primary: string; shadow: string; highlight: string };
type SemanticHair = { style: 'crop' | 'curl' | 'sweep' | 'long'; volume: 1 | 2 | 3; palette: SemanticPalette };
type SemanticFace = { expression: 'neutral' | 'smile' | 'grin'; eyeColor: string };
type SemanticOutfit = { top: SemanticPalette; bottom: SemanticPalette; footwear: SemanticPalette; outerwear: boolean };
type SemanticAccessory = { kind: 'glasses' | 'beard'; color: string };
type AvatarStyleV1 = { shading: 'block' | 'soft'; outline: boolean };
type MinecraftProfileV1 = { geometry: 'classic' | 'slim'; outerLayers: boolean };
type RobloxClassicProfileV1 = { blockAvatarNoticeAccepted: boolean };
type SemanticAppearanceV1 = { complexionPalette: SemanticPalette; hair: SemanticHair; face: SemanticFace; outfit: SemanticOutfit; accessories: readonly SemanticAccessory[]; style: AvatarStyleV1 };
type IdentityOperation = { op: 'set-palette'; field: 'complexion' | 'hair' | 'top' | 'bottom' | 'footwear'; value: SemanticPalette; provenance: FieldProvenanceV1 };
type AvatarOperation = IdentityOperation | { op: 'set-hair'; value: Pick<SemanticHair, 'style' | 'volume'> } | { op: 'set-expression'; value: SemanticFace['expression'] } | { op: 'set-accessories'; value: readonly SemanticAccessory[] } | { op: 'set-style'; value: AvatarStyleV1 };
type AvatarFrame = { identity: IdentityProfileV1; recipe: AvatarRecipeV1 };
type RecipeFault = { kind: 'invalid-seed'; path: string; message: string };
type AvatarFault = { kind: 'revision-conflict' | 'invalid-operation'; path?: string; message: string };
type CompilerFault = { kind: 'invalid-snapshot' | 'invalid-profile' | 'layout-unavailable' | 'render-failed'; message: string };
type LocalPreflightCheckV1 = { id: string; passed: boolean; message: string };
type LocalPreflightReportV1 = { passed: boolean; checks: readonly LocalPreflightCheckV1[] };
type ArtifactV1 = { filename: string; mediaType: string; width?: number; height?: number; pixelDigest?: string; bytes: Uint8Array };
type ArtifactBundleV1 = { compiler: 'minecraft-v1' | 'roblox-classic-v1'; sourceDigest: string; artifacts: readonly ArtifactV1[] };
```

`ArtifactV1.bytes` is transient compiler output and is encoded for download only; it is never JSON-serialized into backups or manifests. A valid `FieldProvenanceV1` has exactly one of these combinations: `default` or `manual` requires empty `sourcePhotoIds` and `not-applicable`; `photo-analysis` with retained evidence requires nonempty IDs and `available`; photo-derived accepted data whose evidence was deleted requires empty IDs and `deleted`. All other combinations are validation faults.

`SemanticAccessory` represents avatar-worn appearance intent only. It cannot represent props, functional Tools, vehicles, Roblox asset IDs, or gameplay behavior. `PlatformCompiler<TProfile>` is the first-release interface for Minecraft and Roblox Classic clothing; future experience-asset or Studio-handoff pipelines require separately approved interfaces.

## 9. Identity Library and Source Photo Handling

### 9.1 One-person library

Each browser profile contains exactly one active identity lineage, identified by one opaque `libraryId`. The `identities` store contains revisions of that lineage, not multiple people. That person may save many Avatar Recipes.

Starting for another person requires an explicit destructive confirmation. The app opens one read-write transaction spanning every object store, clears every store, writes a new `meta` record with a new `libraryId`, and commits before accepting any new photo or recipe. It does not call `indexedDB.deleteDatabase()` for this flow. Transaction abort leaves the prior library intact; transaction commit leaves exactly one new empty lineage.

The UI does not request a real name. Recipe labels are local free text with a safe default such as `Avatar 1`.

### 9.2 Normalization

The app persists only Normalized Source Photos, never raw or original file bytes.

On import or capture:

1. Decode locally and apply orientation.
2. Reject unsupported or corrupt images without changing the library.
3. Bound the longest edge to 2048 pixels while preserving aspect ratio.
4. Re-encode photographs as JPEG at quality `0.92` and alpha-bearing sources as PNG.
5. Exclude EXIF, GPS, device metadata, filenames, and original filesystem paths.
6. Compute a digest over normalized bytes.
7. Store the normalized blob only after the user confirms the photo role.
8. Release the original bytes, decoded buffers, temporary canvases, object URLs, and pre-confirmation captures immediately after normalization succeeds, is cancelled, or fails.

The confirmed `focusRegion` is persisted as three normalized numbers in `[0, 1]`: `centerX`, `centerY`, and square `size`. It is the only persisted crop/highlight state in Spec 1. Thumbnails, masks, landmarks, decoded pixel buffers, and analyzer-private state are transient and are never persisted.

No network request occurs during these steps.

### 9.3 IndexedDB schema

Database name: `my-avatars`.

Initial object stores:

| Store | Contents |
| --- | --- |
| `meta` | Schema version, library ID, timestamps, migration state |
| `photos` | Normalized Source Photo blobs and metadata |
| `identities` | Revisions of the database’s single identity lineage |
| `recipes` | Versioned Avatar Recipes and active recipe pointer |
| `drafts` | Recoverable unaccepted edits; never analyzer-private model state |
| `artifacts` | Optional derived artifact cache keyed by source and compiler digests |

Artifact caches are disposable. Normalized Source Photos, accepted identities, and recipes are durable until explicit deletion or browser storage eviction.

### 9.4 Quota and corruption

- Estimate storage before committing a photo.
- If a write fails, keep the current in-memory avatar and existing library unchanged.
- Offer retry, delete-unused-photos, or continue without saving.
- Never delete accepted data automatically to make room.
- An IndexedDB version upgrade performs only transaction-local store/index changes. Any data rewrite first copies affected records into a `migration-backup` record inside `meta`; the same upgrade transaction deletes that record only after validation succeeds. Transaction abort exposes the previous database version unchanged. On a corrupt database that cannot open, offer complete reset; when the last valid schema can open, offer a photo-free library backup or complete reset.

### 9.5 Deletion and backup

The UI provides:

- Delete one Normalized Source Photo.
- Delete all Normalized Source Photos while retaining manually editable recipes.
- Delete one saved look.
- Delete the entire Identity Library.

Deleting a photo atomically removes its blob, thumbnails, masks, pending proposals, unaccepted drafts derived from it, and disposable artifact caches. Accepted semantic values remain editable, but their provenance changes to `evidenceState: 'deleted'` with an empty `sourcePhotoIds` list; no photo digest or recoverable photo metadata remains.

Backups are versioned **photo-free library backups**, not recipe-only fragments. A backup is canonical UTF-8 JSON shaped as `{ format: 'my-avatars-library-backup', version: 1, libraryId, exportedAt, activeIdentity, recipes, activeRecipeId }`. It contains the accepted semantic identity snapshot, recipes, platform profiles, and sanitized provenance. It contains no Normalized Source Photo, photo ID, photo digest, focus region, mask, analyzer artifact, or deleted-evidence identifier. Every exported photo-derived provenance entry uses empty `sourcePhotoIds` and `evidenceState: 'deleted'`.

Import into an empty database atomically restores one identity lineage under the backup `libraryId`. Import into a non-empty library is rejected when the ID differs. A matching-ID import requires explicit destructive confirmation and, in one transaction, clears photos, identities, recipes, drafts, and artifacts before restoring the backup's non-photo state; failure aborts the complete replacement. Photo-library export and cloud synchronization are excluded from this release.

## 10. Progressive Capture and Proposal Flow

Nothing is required before preview or export. A polished default avatar is available immediately.

Capture ingredients are progressive:

1. Face reference.
2. Hair reference.
3. Outfit reference.
4. Optional smile, side angles, or detail references.

Every capture supports camera, upload, manual crop/focus, and cancellation. Mirrors and rear-camera outfit photos are acceptable. Advisory blur, lighting, framing, and coverage checks never trap the user; they may retake, continue with a warning, or return to manual editing.

Analysis flow:

1. Select one or more Normalized Source Photos by role.
2. Run `PaletteAnalyzerV1` for a supported role; unsupported roles remain reference-only and use manual editing.
3. Produce a Proposed Change against an explicit base identity revision.
4. Render the proposal beside the current accepted result.
5. Explain changed fields, evidence roles, confidence band, and warnings.
6. Accept all, accept selected fields, reject, or edit manually.
7. Commit accepted operations transactionally through the kernel and Identity Library.

Stale proposals are rejected when the base revision no longer matches. Failed analysis cannot erase photos, the accepted identity, or the current recipe.

## 11. Minecraft Compiler Contract

The Minecraft compiler enforces centrally:

1. Transparent modern 64 x 64 RGBA PNG output.
2. Valid head, torso, arm, and leg regions.
3. Correct independent left/right limb regions.
4. Correct Classic and Slim layouts.
5. Hair on the hat/outer-head layer, never on the base face as a shortcut.
6. Aligned outer clothing layers with valid transparency.
7. Non-empty required regions and rejection of partial sheets.
8. Deterministic decoded RGBA and `pixelDigest` for a given snapshot, profile, and compiler version.
9. Exact decoded-pixel agreement between the 2D preview and downloaded artifact.

Default filename: `my-avatar-minecraft.png`.

Three.js is a lazy enhancement. A CDN, import, WebGL, or viewer failure cannot prevent 2D preview, editing, validation, or download. Critical production assets are self-hosted for offline use.

## 12. Roblox Classic Compiler Contract

The Roblox Classic compiler creates a **My Avatars export package** containing:

1. `my-avatar-roblox-shirt.png`
2. `my-avatar-roblox-pants.png`
3. `manifest.json`
4. `README.txt`

The ZIP is a My Avatars convenience package, not a Roblox asset, upload bundle, or recognized import format. Roblox’s documented workflow accepts the shirt and pants image files separately.

The compiler uses a checked-in `RobloxClassicTemplateV1` manifest that pins:

- Official source: `https://create.roblox.com/docs/avatar/classic-clothing`.
- Verified date: 2026-07-11.
- Reviewed `Roblox/creator-docs` commit: `4efde174e15740740cf2a5dddeec53075db618fe`.
- Shirt dimensions: 585 x 559.
- Pants dimensions: 585 x 559.
- Official shirt-template LFS SHA-256: `c87e4dfbc6cbee15e7f7283a74983f3762b715b1b366c0514754316474697d8c`.
- Official pants-template LFS SHA-256: `c57244d5bb9605f1e3b7de245c201666741b0fb147905703f3371c0aef17c73b`.
- Every product-owned region rectangle, safe zone, alpha/color rule, compiler version, and local-preflight rule.
- Which rules are Roblox-documented and which are My Avatars product checks.

`RobloxClassicTemplateV1` defines rectangles as half-open `[x, y, width, height]` pixel regions on a 585 x 559 canvas. The reviewed numeric region map is:

```json
{
  "torso": { "up": [231, 8, 128, 64], "right": [165, 74, 64, 128], "front": [231, 74, 128, 128], "left": [361, 74, 64, 128], "back": [427, 74, 128, 128], "down": [231, 204, 128, 64] },
  "rightLimb": { "up": [217, 289, 64, 64], "left": [19, 355, 64, 128], "back": [85, 355, 64, 128], "right": [151, 355, 64, 128], "front": [217, 355, 64, 128], "down": [217, 485, 64, 64] },
  "leftLimb": { "up": [308, 289, 64, 64], "front": [308, 355, 64, 128], "left": [374, 355, 64, 128], "back": [440, 355, 64, 128], "right": [506, 355, 64, 128], "down": [308, 485, 64, 64] }
}
```

The shirt painter uses `torso`, `rightLimb` as the right arm, and `leftLimb` as the left arm. The pants painter uses `torso` for the waist/upper garment continuation, `rightLimb` as the right leg, and `leftLimb` as the left leg. It fills only those rectangles; all pixels outside them remain transparent. Local preflight requires each listed rectangle to be nonempty, every outside pixel to have alpha zero, and exact dimensions. These coordinates were reviewed against the pinned official images, but the coordinate transcription and color rules are My Avatars product checks rather than a Roblox acceptance guarantee.

No Roblox template media is redistributed. My Avatars generates transparent canvases from its reviewed numeric region map and uses synthetic fixtures. If the region map or provenance manifest is absent or fails its tests, Roblox compiler implementation is blocked while Minecraft work continues.

`manifest.json` includes:

- My Avatars recipe and identity revision numbers.
- Source digest.
- Compiler and template versions.
- Artifact filenames and pixel digests.
- `localPreflight` results.
- `externalStatus: 'not-submitted'`.
- Semantic appearance summary that contains no photos or biometric data.
- A statement that Roblox import, moderation, compatibility, and publication are external.

`README.txt` explains the manual Roblox workflow:

1. Unzip the My Avatars package locally.
2. Upload the shirt and pants images separately through the appropriate Roblox Classic clothing workflow.
3. Do not upload `manifest.json` or `README.txt`.
4. This compiler does not create a Classic T-shirt or `ShirtGraphic`.
5. Test the candidates on a Block Avatar in Studio.
6. Many modern or user-generated bodies do not display 2D Classic clothing correctly.
7. Hair, faces, accessories, bodies, upload, moderation, fees, and publication are not generated or performed by this compiler.

The adapter must not use `accepted`, `approved`, `Roblox-valid`, “works with Roblox avatars,” one-click equipping, universal body compatibility, Marketplace acceptance, or free-publication language. It must not request or store Roblox credentials.

## 13. Product Routes and User Flow

Public PWA routes:

1. `./#/studio` — dependable avatar editing and exact preview.
2. `./#/library` — Normalized Source Photos, accepted identity, and saved looks.
3. `./#/experimental/capture` — isolated progressive capture and proposal review.
4. `./#/export/minecraft` — Minecraft profile, validation, preview, and download.
5. `./#/export/roblox-classic` — Roblox Classic profile, local preflight, limitations, and My Avatars package download.

Compatibility mapping is exact:

- `./#/solid` redirects to `./#/studio`.
- `./#/solid/library` redirects to `./#/library`.
- `./#/experimental` redirects to `./#/experimental/capture`.
- Unknown hashes resolve to `./#/studio` with an accessible notice and no data mutation.

Redirect resolution must not import the experimental module. Experimental module failures cannot prevent `./#/studio`, `./#/library`, or exports from starting.

Primary flow:

1. Open a polished default look.
2. Edit manually or open the local library.
3. Optionally capture/import a reference and review a bounded palette proposal.
4. Save the current look.
5. Choose Minecraft or Roblox Classic.
6. Adjust bounded platform options.
7. Validate, inspect, and download.

## 14. Block Adventure Presentation System

The approved visual direction is **Block Adventure**:

- Dark navy and violet surfaces.
- Mint and cool-blue action accents.
- Bold game-forward headings.
- High-contrast selection, focus, warning, and success states.
- A prominent avatar stage with clear Build, Library, and Export navigation.
- Friendly privacy language without making the product feel clinical or babyish.

Accessibility is normative:

- Semantic landmarks and heading order.
- Stable control IDs.
- Full keyboard navigation.
- Visible focus.
- Minimum target sizes appropriate for mobile.
- Text alternatives for canvases and status changes.
- Accessible announcements for analysis, validation, persistence, and export.
- `prefers-reduced-motion` behavior.
- No reliance on color alone.

Mark or another GUI contributor may replace layouts and visual components through the presentation seam. GUI work must preserve view-model contracts, control semantics, privacy states, validation states, and browser-test selectors.

## 15. Failure and Recovery Model

All user-facing failures are typed and recoverable where possible.

| Failure | Required behavior |
| --- | --- |
| Camera denied | Continue with upload, defaults, and manual editing |
| Decode failure | Reject only the new file; keep library and avatar unchanged |
| Normalization or encode failure | Persist nothing and release temporary bytes, pixels, canvases, and object URLs |
| Capture cancelled after decode | Persist nothing and release all transient resources |
| Analyzer/model unavailable | Keep photos and provide manual ingredient controls |
| Low-confidence analysis | Show proposal and warnings; never auto-apply |
| Stale proposal | Re-run or discard; never apply against a newer identity revision |
| IndexedDB unavailable | Continue in memory and permit immediate export |
| Quota exceeded | Keep existing data; offer explicit cleanup or unsaved continuation |
| Migration failure | Reopen last valid schema; offer a photo-free library backup or reset |
| Deletion transaction failure | Roll back the complete logical deletion and report that nothing was deleted |
| Invalid or foreign backup | Reject without mutating the current library |
| Detected browser storage eviction | Start a new empty library with an accessible explanation; never imply recovery succeeded |
| Three.js/WebGL failure | Preserve exact 2D preview and all exports |
| Network/CDN failure | Preserve the complete dependable studio and local compilers |
| Roblox ZIP/package failure | Block only the My Avatars Roblox package download; preserve recipe and Minecraft output |
| Service-worker install/update failure | Retain the last complete app shell and current IndexedDB data |
| Corrupt app-shell cache | Discard only the corrupt cache version and provide online recovery |
| My Avatars Roblox Classic preflight failure | Block that package download until corrected; Minecraft remains available |
| Minecraft validation failure | Block that PNG download until corrected; Roblox remains available |

No failure in one compiler disables the other compiler or corrupts the shared recipe.

## 16. Rename and Migration

### 16.1 Naming map

| Current | Target |
| --- | --- |
| Skin Forge | My Avatars |
| repository `minecraft` | repository `my-avatars` |
| package name `minecraft` | package name `my-avatars` |
| `generateSkin` | `compileMinecraftAvatar` |
| `skinCanvas` | `minecraftTextureCanvas` |
| `createSkinViewer` | `createMinecraftAvatarViewer` |
| `updateSkin` | `updateMinecraftTexture` |
| `minecraft-skin.png` | `my-avatar-minecraft.png` |
| generic “skin generator” | cross-game avatar studio |

Standards-facing Minecraft symbols may retain `Skin` when that is the clearest compatibility term.

### 16.2 Local rename artifacts and separately authorized deployment

Spec 1 implementation renames product copy, source symbols, storage names, package metadata, manifests, canonical-path configuration, and locally testable redirect artifacts. The local target configuration uses repository name `my-avatars` and Pages base path `/my-avatars/`.

The implementation must not rename the GitHub repository, push a branch, alter GitHub Pages settings, deploy a redirect site, publish canonical metadata, or change a production URL. It produces:

1. A static, locally tested compatibility page for `/minecraft/` that redirects to `/my-avatars/`, preserves only the three recognized hash mappings, and drops query parameters. No hash or an unrecognized hash redirects exactly to `/my-avatars/#/studio`.
2. A deployment runbook covering remote repository rename, Pages routing, service-worker scope, canonical metadata, redirect verification, and rollback.

Remote rename, live redirect verification, production rollback rehearsal, and retirement of the old deployment are deployment gates requiring separate authorization.

### 16.3 Local data migration

The current production prototype has no IndexedDB library. Spec 1 performs no legacy preference import; it creates the pinned default Identity Profile and `Avatar 1` recipe. It must not invent photo history or identity provenance.

New IndexedDB migrations are forward-only, transactional, versioned, and tested against fixtures. The application keeps the previous valid database until the new schema commits successfully.

## 17. Privacy and Safety Invariants

1. Normalized Source Photos remain on the device unless a future, separately approved flow obtains explicit informed consent.
2. Normalized Source Photos never enter downloads, manifests, telemetry, prompts, logs, URLs, service-worker caches, or error reports.
3. Filenames, EXIF, GPS, original paths, and device metadata are discarded during normalization.
4. The app creates no reusable biometric or face-recognition embedding.
5. Raw image pixels are unavailable to Minecraft and Roblox compilers.
6. Clothing imagery can still reveal personal, branded, or copyrighted details; the Roblox export view must explain that uploading either candidate moves that image into Roblox's systems and moderation flow.
7. Photos of branded clothing or copyrighted characters do not grant publishing rights; the UI avoids claiming otherwise.
8. Remote telemetry and Workshop features remain disabled until their existing gates pass.
9. The Workshop may alter constrained data configuration only; it cannot publish executable HTML, CSS, JavaScript, Luau, prompts-as-code, or repository patches.

## 18. Offline and PWA Requirements

After the first successful load, the dependable studio, library, manual editing, Minecraft compiler, Roblox Classic compiler, validation, exact 2D previews, and downloads work without network access.

The service worker scope is `/my-avatars/`. It precaches only a versioned, checked-in allowlist of public static app-shell assets. “First successful load” means every required allowlisted asset has been fetched and committed to one complete cache version; installation failure preserves the previous complete version.

Fetch handlers bypass `blob:`, `data:`, downloads, generated artifacts, `/workshop/`, authenticated requests, and every request absent from the public allowlist. The service worker never caches Normalized Source Photos, IndexedDB blobs, or generated private artifacts.

A waiting worker activates only when there is no unsaved draft or migration and the user chooses Reload. Activation deletes obsolete app-shell caches but never touches IndexedDB. Cache tests inspect Cache Storage and prove every prohibited class is absent.

## 19. Testing and Release Gates

### 19.1 Pure-module tests

Use Node’s built-in `node:test` runner for pure ES modules. Browser scenarios use the shared `/home/jaime/src/_util/_browse` proxy; the implementation must not add a second browser automation stack.

Required coverage:

- Kernel seed and transaction validation.
- Revision conflicts and stale proposals.
- Identity-to-snapshot projection.
- Provenance exclusion from artifacts.
- Minecraft Classic/Slim region completeness.
- Hat-layer hair and outer-layer alignment.
- Roblox Classic template manifest, region maps, dimensions, and local preflight.
- Deterministic artifact digests.
- IndexedDB migrations using versioned fixtures.
- Deletion cascades and quota faults.

### 19.2 Checked-in fixtures

The task explicitly authorizes a minimal, synthetic fixture set:

- Platform-neutral identity fixtures with no real person’s photos.
- Golden Minecraft Classic and Slim decoded RGBA fixtures.
- Golden synthetic Roblox Classic shirt and pants fixtures.
- Corrupt, partial, and boundary-case recipes.
- IndexedDB migration fixtures.

No personal reference photo, `face-comparison.html`, downloaded private artifact, or generated screenshot becomes a test fixture.

### 19.3 Browser checks

Use the shared `/home/jaime/src/_util/_browse` browser proxy rather than adding another browser stack.

Required scenarios:

1. Start and export without photos.
2. Add a face photo, preview a proposal, reject it, and verify no mutation.
3. Accept selected proposal fields and verify provenance.
4. Save multiple looks for one person.
5. Reload offline and reproduce both platform artifacts.
6. Exercise Minecraft Classic and Slim.
7. Download and inspect the My Avatars Roblox Classic export package.
8. Deny camera and WebGL and continue successfully.
9. Simulate IndexedDB quota and migration failure.
10. Intercept network requests and prove that Normalized Source Photos never leave the device.
11. Delete photos and the entire library and verify all related blobs and caches are absent.
12. Verify keyboard, focus, reduced motion, mobile layout, and accessible announcements.

### 19.4 Fidelity gate

`PaletteAnalyzerV1` makes no likeness claim. Any future analyzer that proposes geometry, landmark, silhouette, expression, or person-level likeness changes remains disabled until a separate approved contract pins its supported roles, operation allowlist, warning taxonomy, calibration fixtures, consented evaluation set, exact statistic, threshold, and confidence interval.

The retired self-referential `0.9327` score is not displayed or used as evidence.

### 19.5 Release gate

A release is blocked unless:

- All pure tests pass.
- Browser scenarios pass on the defined mobile and desktop matrix.
- Minecraft validators and My Avatars Roblox Classic fixture/preflight validators pass.
- Offline export passes.
- Network interception finds no Normalized Source Photo egress.
- The local redirect fixture and `/my-avatars/` base-path behavior are verified.
- The separately authorized deployment runbook contains explicit remote verification and rollback steps.
- No sensitive local artifact is staged or deployed.

## 20. Future Attachment Seams

The `terra_max` reconnaissance established these future boundaries:

1. Roblox rigid wearables require meshes, textures, attachments, Studio fitting, UGC validation, and moderation.
2. Layered clothing requires inner and outer cages plus either valid skinning or a supported `WrapLayer.AutoSkin` configuration verified in Studio.
3. Full bodies require 15 named body meshes, the R15 hierarchy, 19 attachments, outer cages, dynamic-head/FACS requirements, and policy/modesty gates.
4. Experience props use a separate object compiler.
5. Functional Tools require a direct-child `Handle`, grip/weld configuration, Studio assembly, and fixed, audited, server-authoritative behavior; glTF does not contain Roblox `Tool` hierarchy or gameplay behavior.
6. Wearables and bodies use Studio Importer, AFT or Avatar Setup, UGC validation, and moderation. Props and Tools use Importer checks, hierarchy validation, playtests, security/performance gates, and asset moderation; clothing UGC validation does not apply to them.
7. Browser preflight is advisory; the applicable current Roblox Studio and platform checks remain authoritative.
8. Publishing may require accounts, verification, fees, memberships, moderation, and policy compliance.

The smallest future spikes are:

- One fixed-topology rigid cosmetic accessory round trip.
- One known-good layered top round trip.
- One static experience prop before any functional Tool.
- One child-safe Tool using only a reviewed behavior module.

The first My Avatars release promises none of these capabilities.

## 21. Decision and Revisit Log

Mark or David may revisit these choices later. A revisit creates a new design decision; it does not silently modify this design during implementation.

| Topic | Current decision | Preserved alternatives |
| --- | --- | --- |
| Product name | My Avatars | Skin Forge rejected |
| Rename depth | Full rename | Public-brand-only; staged technical rename |
| Visual direction | Block Adventure | Friendly Workshop; Personal Gallery |
| Product breadth | Multi-platform program | Minecraft-only; platform-ready but later |
| First additional game output | Roblox Classic | Profile avatar art; layered 3D immediately |
| Program boundary | Three separate specs | One mega-spec rejected |
| Source-photo persistence | Retain normalized local photos | Derived-only kit; ephemeral session |
| Library ownership | One person, many looks | Multiple local people; flat shared pool |
| Capture | Progressive and optional | Required guided set; single-photo-only |
| Cross-game continuity | Semantic identity | Literal equality; independent game looks |
| Future Roblox items | Experience assets and wearables, separately staged | Either lane alone |
| Architecture | Semantic core plus native compilers | Minecraft canonical; independent studios |

### 21.1 GUI contribution boundary

Mark’s interest in GUI development is supported intentionally. GUI contributors may work on presentation components, interaction choreography, theme tokens, accessible layouts, mockups, and validated presentation configuration. The implementation plan must give those files a narrow dependency on `StudioViewModel` and must include screenshot or browser checkpoints.

GUI contributors do not own identity semantics, photo persistence, compiler output, migration, privacy controls, or runtime code publication.

## 22. Implementation Authorization and Model Routing

The user authorized autonomous local implementation on 2026-07-11. This authorization covers in-scope source, tests, synthetic fixtures, local commits, and non-destructive verification. It does not authorize deployment, push, repository rename on GitHub, Roblox upload or publication, purchases, credential changes, or other external mutations.

Recommended model routing:

- GPT-5.6 Luna at medium effort for explicit implementation tasks and tests.
- GPT-5.6 Luna at low effort for mechanical renames, formatting, fixtures, and straightforward CSS.
- GPT-5.6 Terra at medium or high effort for cross-module integration and difficult debugging.
- GPT-5.6 Sol at high effort for architecture, privacy, migrations, and contract decisions.
- GPT-5.6 Sol at xhigh effort for the final privacy, migration, security, and release audit.

Luna must stop and escalate when the plan permits two interpretations, a task crosses its declared files, a migration or privacy invariant changes, Roblox rules conflict with the pinned contract, or the same focused test remains red after two attempts.

## 23. Success Criteria

This design succeeds when:

1. The local application, source, package metadata, documentation, and deployment artifacts are unambiguously My Avatars.
2. A user can create, save, reopen, and edit multiple looks for one person without photos.
3. Optional local photos can propose bounded palette changes without silent mutation or a likeness claim.
4. The same accepted semantic identity produces a recognizable native Minecraft artifact and Roblox Classic shirt and pants image candidates conforming to the pinned templates.
5. Both compilers are deterministic, isolated, validated, and usable offline.
6. Normalized Source Photos remain local, metadata-free, deletable, and absent from every artifact and network request.
7. GUI work can evolve without coupling presentation to privacy, storage, kernel, or compiler internals.
8. Old links and local state migrate or fail safely.
9. Every release gate is backed by repeatable tests and browser evidence.
10. A Luna implementation agent can execute the later plan without making new product or architecture decisions.
