# Final Solution: My Avatars Mode-Isolated Modular Workbench

## Status and Scope

This is the authoritative target for My Avatars. It replaces earlier required-photo flows, IP-gated Workshop concepts, shared Solid/Experimental DOM designs, and the former self-referential likeness score. The local foundation now implements the dependable kernel, compilers, exact public PWA shell, and optional viewer seam; remote rename and production deployment remain separately authorized work.

The product must remain useful without an account, a camera, a network connection, an AI service, or telemetry. Its primary users include children, so photos stay on the device by default and remote features fail closed.

## Product Experience

The mobile studio is stage-first: the playable avatar is the main surface, an explicit ingredient grid shows what can be changed, and focused bottom sheets or full-screen editors handle one ingredient at a time. Every ingredient starts with a good photo-free default. Nothing is required.

Users can create or replace:

1. Face and skin tone.
2. Hair color, shape, texture, and curl volume.
3. Eyes, brows, mouth, and expression.
4. Shirt or outfit, including a direct outfit photograph.
5. Arms, legs, footwear, accessories, and Classic/Slim geometry.

Previously created ingredients and avatars can be reused. Capture may use the front or rear camera, mirrors, uploads, and optional finger highlighting to indicate the subject or garment. The highlight is guidance, not a mandatory segmentation step.

## Route and Mode Isolation

Public GitHub Pages routes under `/my-avatars/` are:

1. `./#/studio`
2. `./#/library`
3. `./#/experimental/capture`
4. `./#/export/minecraft`
5. `./#/export/roblox-classic`

The Cloudflare Worker serves the private Workshop from the same origin as its authenticated APIs:

1. `/workshop/#/login`
2. `/workshop/#/setup`
3. `/workshop/#/preview`
4. `/workshop/#/versions`

Dependable and Experimental routes are separate modules, not conditional branches inside one large controller. They share only validated domain output. Experimental failures, model downloads, camera permissions, and optional dependencies must not prevent the studio, library, or exports from starting. The three legacy hashes `#/solid`, `#/solid/library`, and `#/experimental` map only to their documented replacements.

## Authoritative Domain Contract

```ts
type AvatarFrame = {
  revision: number;
  recipe: AvatarRecipeV1;
  model: 'classic' | 'slim';
  rgba: Uint8ClampedArray;
  pixelDigest: string;
};

interface AvatarKernel {
  start(seed?: unknown): Result<AvatarFrame, RecipeFault>;
  transact(input: {
    baseRevision: number;
    operations: readonly AvatarOperation[];
  }): Result<AvatarFrame, AvatarFault>;
}
```

`AvatarKernel` is deterministic and has no DOM, storage, network, camera, or Three.js dependency. `StudioSession` is the application facade. It hides history, drafts, persistence recovery, preview updates, exports, and accessible announcements.

Recipes are versioned data. Operations are validated domain commands rather than arbitrary property patches. Transactions reject stale `baseRevision` values. Persistence stores recipes and metadata, not uploaded photos. Migrations are explicit and reversible where practical.

## Minecraft Rendering Invariants

The composer must enforce these rules centrally:

1. Output is a transparent modern `64 x 64` RGBA PNG.
2. All required faces for the head, torso, arms, and legs are populated consistently.
3. Mirroring and duplication follow the selected Classic or Slim layout.
4. Hair is placed on the hat/outer-head layer and is never caller-configurable as a base-face shortcut.
5. Outer layers align with their base body parts and preserve valid transparency.
6. Empty, partial, or merely alpha-present sheets do not count as valid skins.
7. Exact decoded RGBA and `pixelDigest` are authoritative; encoded PNG byte equality is not.

The exact 2D canvas preview and exported decoded pixels must agree. Three.js is a lazy, optional enhancement. A CDN failure, WebGL failure, or viewer exception cannot block editing or export.

## Offline Shell

The checked-in service worker is scoped to `/my-avatars/` and precaches only the versioned paths in `deploy/pages-allowlist.txt`. A new version is promoted only after every allowlisted response is staged successfully; failed installation retains the previous complete version. Fetch handling excludes authenticated, non-GET, nonallowlisted, Workshop, download, generated, `blob:`, and `data:` requests. It never opens or deletes IndexedDB.

An installed update waits. It activates only after the user chooses Reload and the presentation reports no unsaved draft or migration. Activation removes obsolete My Avatars shell caches only. The Pages workflow assembles a temporary artifact from the checked-in allowlist and never uploads the repository root.

## Solid Mode

Solid is the dependable product. It starts with a polished default avatar even when no photo exists. This requires removing the current dependency where automatic colors call `paletteFromImage()` and dereference `sourceImage`.

Solid supports ingredient selection, manual tuning, saved local avatars, exact 2D inspection, optional 3D viewing, and PNG export. Its dependencies are self-hosted when they are required for offline use. Solid never contacts the telemetry or Workshop backend.

## Experimental Mode

Experimental contains guided capture, multiple-photo consensus, browser-local landmarks, segmentation, subject highlighting, and request-driven local commands. Face, Hair, and Outfit photos are independent optional ingredients. The system should use multiple angles when supplied but degrade cleanly to one image or no images.

Photo-derived generation must remain disabled as a production-quality claim until it passes the independent fidelity gate. The old `0.9327` score must be removed. A useful evaluation compares the source person, an independently authored target, and site output without using the generator's own reconstruction as the reference.

Simple requests in the Experimental text box execute locally without a Send button. Remote logging is intended but stays disabled until every privacy gate in `PRIVACY_AND_SAFETY.md` passes.

## Developer Workshop

Workshop is a password-gated, same-origin Worker application for household experimentation. It may change constrained, schema-validated configuration such as labels, themes, presets, supported local commands, feature flags, or content. It must never publish executable JavaScript, HTML, CSS, Worker code, prompts that become code, or unrestricted repository patches.

The workflow is preview, structured diff, publish, immutable version, and undo/restore. It includes conflicts, a schedule, kill switch, and audit events. Public clients consume only signed or integrity-checked configuration with a last-known-good fallback.

Authentication uses a private one-time bootstrap token in the URL fragment. The first visit immediately removes the fragment with `history.replaceState()`, lets the household set one shared password, and invalidates the bootstrap token. D1 stores only a random salt and PBKDF2-SHA-256 verifier. Sessions use first-party `Secure`, `HttpOnly`, `SameSite=Strict` cookies. There are no accounts, passkeys, email recovery, or IP restrictions.

## Hosting and Cost Boundary

1. GitHub Pages hosts the public static PWA.
2. Cloudflare Workers serves Workshop and narrow telemetry endpoints.
3. D1 stores authentication, sanitized requests, aggregates, versions, and audit records.
4. KV may cache public configuration and kill switches.
5. R2 is excluded until a strict storage cutoff and deletion path exist.
6. GitHub Actions polls sanitized aggregates; browsers never receive GitHub credentials.

All components must stay within free tiers. Remote writes disable before quotas are exceeded. Local avatar creation and export continue through backend outages, quota exhaustion, rejected telemetry, and Workshop shutdown.

## Delivery Order

1. Extract and test Minecraft invariants and the deterministic kernel.
2. Create photo-free defaults and the exact 2D preview/export path.
3. Isolate and lazy-load Three.js.
4. Build separate Solid and Experimental route modules around `StudioSession`.
5. Add local persistence and recipe migration.
6. Add the installable PWA with self-hosted critical assets.
7. Add the same-origin password-gated Workshop and constrained configuration.
8. Add privacy-gated sanitized telemetry.
9. Add guided local capture and segmentation behind the independent fidelity gate.

No stage may weaken the privacy boundary, hair-layer invariant, deterministic export, or offline-capable Solid path.
