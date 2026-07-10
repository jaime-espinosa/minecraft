# Skin Forge Mobile Avatar Studio Design

Date: 2026-07-10

## Objective

Turn Skin Forge into a mobile-first, installable PWA with two top-level modes:

1. **Solid** is a dependable, complete Minecraft avatar studio that works without photos, models, accounts, or network services.
2. **Experimental** adds local natural-language commands, photo-derived ingredients, telemetry, research contribution, and a password-gated Developer Workshop.

The product must remain free to operate. Photos remain on-device unless a user explicitly enables Research Contribution. Hair always uses the Minecraft hat layer.

## Core Experience

Every new character starts as a polished, playable default avatar. Nothing is required before preview or download. The avatar is composed from replaceable ingredients:

1. Face
2. Hair
3. Skin tone
4. Expression
5. Top
6. Bottom
7. Shoes
8. Classic or Slim body
9. Accessories

Tapping an ingredient opens a focused dialog containing presets, local camera/upload options where supported, and previously saved device-local ingredients. The current ingredient remains active until a replacement succeeds.

## Solid Mode: v1

Solid mode is the production-quality baseline and cannot depend on Experimental configuration.

1. Render a hand-authored-quality default avatar immediately.
2. Provide intentional presets and manual palette/style controls for every supported ingredient.
3. Save avatar recipes and reusable ingredients in IndexedDB on the current device.
4. Compose a valid modern `64 x 64` transparent RGBA Minecraft PNG.
5. Support correct Classic and Slim UV layouts with independent limbs.
6. Render base and outer layers in the 3D preview.
7. Show a large 2D skin sheet and download the exact composer canvas.
8. Keep generation, inspection, and download working when WebGL, Three.js, storage, or the network fails.

Solid mode contains no prompt telemetry and never uploads images.

## Experimental Mode: v2

A persistent top toggle switches between Solid and Experimental without resetting the avatar. Experimental shows an instruction field immediately below the toggle.

The instruction field accepts commands such as:

- `make the hair shorter`
- `use a dark blue shirt`
- `make the preview taller`
- `undo the last workshop change`

The first implementation is a deterministic, browser-local parser. It maps supported phrases into a constrained operation schema. It does not call a cloud LLM. Supported avatar operations execute immediately; partially supported requests explain what changed and what was ignored.

Experimental photo ingredients use this local pipeline:

1. Capture or import a photo.
2. Run advisory blur, lighting, framing, and coverage checks.
3. Propose a browser-local face, hair, subject, or clothing mask.
4. Let the user refine the translucent mask with Add, Remove, undo, reset, and pinch zoom.
5. Extract structured geometry, palette, contrast, silhouette, and pattern cues.
6. Render those cues through deterministic Minecraft templates rather than shrinking the photo.
7. Compose the ingredient with unchanged defaults and selected ingredients.

If a model is unavailable, the dialog falls back to manual focus and presets. Failures never erase the current ingredient.

## Fidelity Gate

Photo generation remains experimental until a bounded renderer spike proves value over defaults. The spike implements only `FeatureAnalyzer -> IngredientRenderer -> SkinComposer` and evaluates 15-20 representative mobile photos.

Before the full photo pipeline is promoted, it must demonstrate:

1. Independent blinded raters prefer custom output over the polished default at a preregistered rate meaningfully above 50 percent.
2. The sample spans lighting, skin tones, hair types, clothing patterns, and difficult capture conditions.
3. The declared maximum abandonment rate is met.
4. Required local models load and run within three seconds on iPhone 12 Safari and a defined mid-range Android Chrome device.
5. Automated tests prove Classic/Slim UV correctness, hat-layer hair, outer layers, transparency, independent limbs, and preview/export identity.

No self-generated target or renderer-dependent score is accepted as evidence of likeness.

## Local Library and Identity

IndexedDB stores device-local ingredients, avatar recipes, thumbnails, parser state, and model-version metadata. Clearing site data removes this library.

The telemetry backend issues a random 128-bit anonymous user ID. First names remain local and are not hashed or uploaded because they are low-entropy and non-unique. Server-side identifiers may be HMAC-derived only when stable correlation is necessary.

Anonymous IDs provide approximate user counts and abuse controls. Backend controls may also use rate limits, Cloudflare Turnstile, temporary coarse network blocks, and server-issued deny-list entries. The product does not use device fingerprinting.

## Prompt Telemetry

Submitting an Experimental instruction both executes locally and queues telemetry automatically. There is no separate feedback button. Experimental mode visibly discloses that instruction text is analyzed to improve Skin Forge and that photos and avatar images remain local unless Research Contribution is enabled.

Each command record may contain:

1. Raw instruction text retained for seven days.
2. Sanitized instruction text retained for analysis.
3. Parser tokens and interpreted operations.
4. Supported, partially supported, unsupported, rejected, or failed outcome.
5. Error code, parser version, app version, timestamp, and anonymous user ID.

Normal telemetry excludes photos, masks, skins, avatar pixels, names, account details, phone numbers, email addresses, URLs, and device identifiers.

## Sanitization, Quarantine, and Alarms

All submitted text is untrusted data, never an instruction to repository or agent automation.

1. Enforce strict length, encoding, rate, and JSON schema limits.
2. Detect and redact phone numbers, email addresses, account information, URLs, and likely secrets.
3. Classify avatar scope, unsupported scope, prompt injection, jailbreak language, code, and abuse.
4. Place suspicious records in a separate quarantine store before automated analysis.
5. Never feed quarantined raw text to an LLM or execute it as code.
6. Send GitHub only a safe fingerprint, category, count, and alarm summary.
7. Expose quarantined raw text only through the protected backend polling path.

Request analysis follows `observe -> sanitize -> classify -> cluster -> triage`. Some clusters become automatic backlog candidates; others remain review items. No raw request directly edits the product TODO.

## Research Contribution

Research Contribution is a separate explicit opt-in within Experimental mode. It may upload source photos, corrected masks, selected settings, final approved skins, and likeness ratings. Normal prompt telemetry does not grant image-upload consent.

Useful training examples pair source material with human-corrected and approved outputs. Unreviewed generated skins are not treated as ground truth because they would reproduce existing errors.

Training and distillation happen offline. A compact browser model may infer structured ingredient parameters, while the deterministic renderer remains authoritative for Minecraft pixels. Model inference must remain on-device.

Image ingestion remains disabled until a hard free-storage ceiling and automatic shutoff exist. Cloudflare R2 holds contributed images; D1 holds consent, metadata, pseudonymous identity, ratings, and object references.

## Developer Workshop

Developer Workshop is a capability inside Experimental mode, not a third top-level mode.

1. Access requires one shared Workshop password; there are no accounts, passkeys, recovery flow, or approval steps.
2. The repository, browser bundle, browser storage, telemetry, and logs never contain the password or its plaintext equivalent.
3. Cloudflare stores only a unique salt and PBKDF2-SHA-256 password verifier as encrypted Worker secrets.
4. The browser sends the password only over HTTPS to the Worker login endpoint. The Worker must exclude the request body from logs and discard the plaintext immediately after verification.
5. Successful login returns a random, signed, revocable session in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie with a 12-hour maximum lifetime.
6. Failed logins use rate limits and increasing retry delays. Repeated failures emit a sanitized security alarm without recording attempted passwords.
7. Rotating the verifier or activating the kill switch invalidates all Workshop sessions.
8. A server-side schedule and kill switch control Workshop availability.
9. Workshop commands use the same instruction field and constrained operation schema.
10. Allowed operations cover design tokens, spacing, typography, component order, visibility, sizing, copy, and supported layouts.
11. Arbitrary HTML, JavaScript, URLs, shell commands, workflow definitions, and repository instructions are rejected.
12. The Worker repeats validation; client validation is not trusted.
13. Valid changes publish immediately to a versioned Experimental configuration in Cloudflare KV or D1.
14. Authenticated Workshop devices see the preview configuration immediately.
15. `publish experimental` promotes the current Workshop preview to all Experimental users.
16. `undo`, `rollback`, and `restore version N` provide immediate recovery.
17. Solid mode never reads Workshop configuration.

Workshop deploys configuration, not executable code. This provides immediate visible changes without turning untrusted text into JavaScript or repository access.

## Free Backend and GitHub Automation

GitHub Pages remains the application host. Cloudflare Workers provide the telemetry and Workshop API; D1 stores records and versioned configuration; KV may cache the active configuration; R2 is reserved for capped Research Contribution.

Only free service plans are permitted. The backend tracks quota consumption and disables telemetry or research uploads before free limits are exhausted. Local avatar creation and export continue when backend services are unavailable.

Browsers never receive a GitHub credential and never append directly to repository files. A free scheduled GitHub Action polls a protected Worker endpoint for sanitized aggregates. High-risk alarms may trigger a sanitized `repository_dispatch`. Automation updates a triage inbox or backlog candidate set; raw and quarantined prompts remain outside the public repository.

## Component Boundaries

1. `AvatarStudio` owns the current recipe and ingredient selection.
2. `IngredientDialog` orchestrates presets, capture, upload, and saved choices for one ingredient kind.
3. `CaptureQuality` produces advisory measurements and explanations.
4. `FocusMask` owns the proposed and user-corrected bitmap mask.
5. `FeatureAnalyzer` exposes a versioned per-kind feature contract.
6. `IngredientRenderer` converts features and presets into versioned ingredient pixels.
7. `SkinComposer` is the authoritative Minecraft UV writer and PNG source.
8. `SkinViewer` lazily consumes the composer canvas without blocking generation.
9. `LocalLibrary` encapsulates IndexedDB and quota recovery.
10. `InstructionEngine` parses text into constrained avatar and Workshop operations.
11. `ExperimentalConfig` validates, versions, applies, and rolls back Workshop configuration.
12. `TelemetryClient` sanitizes and queues records without accessing photo canvases.
13. `PwaShell` owns installation, service-worker caching, and offline behavior.

## Failure and Accessibility Requirements

1. Preserve the current avatar and ingredient through every failure.
2. Offer Retry, Keep Current, Choose Preset, and Use Photo Anyway where meaningful.
3. Provide a non-brush correction path for keyboard, switch, and screen-reader users.
4. Make all touch targets at least 44 CSS pixels and avoid color-only state.
5. Announce command outcomes, processing state, errors, and mode changes through accessible live regions.
6. Run generation outside the Three.js initialization path.
7. Queue telemetry briefly when offline, then expire it without blocking local work.
8. Reject invalid Workshop configuration atomically and retain the last known-good version.

## Delivery Sequence

1. Build Solid Avatar Studio and preserve the current generator behind deeper module boundaries.
2. Add the Solid/Experimental toggle and local instruction engine.
3. Add local persistence, PWA shell, and failure-safe 2D export.
4. Add the free telemetry backend, sanitization, quarantine, polling, and GitHub triage automation.
5. Add IP/schedule-gated Developer Workshop with versioned preview, public Experimental promotion, and rollback.
6. Build the bounded fidelity and mobile-runtime spike.
7. Add photo-derived ingredients only if the spike clears the declared gates.
8. Enable capped Research Contribution only after consent, deletion, retention, and free-quota controls pass review.

## Acceptance Criteria

1. Solid mode produces a playable default skin without uploads or network access.
2. Solid and Experimental mode changes preserve the current avatar.
3. Supported text commands execute locally and report deterministic outcomes.
4. Unsupported and malicious commands cannot execute code or alter Solid mode.
5. Prompt telemetry contains no image data and applies seven-day raw retention.
6. Quarantined content cannot reach automated TODO editing or LLM analysis.
7. Workshop access requires a valid password-backed session and respects the schedule and kill switch.
8. Workshop preview, public Experimental publish, undo, and version restore work without Git commits.
9. Cloud service exhaustion disables remote features without affecting generation or export.
10. Browser automation covers preset-only generation, Classic/Slim output, outer layers, download, mode switching, instruction parsing, invalid configuration, rollback, WebGL failure, and offline operation.

## Non-Goals

1. Native iOS or Android applications.
2. Cloud inference for avatar generation.
3. Accounts, passkeys, or cross-device avatar sync.
4. Arbitrary code generation or deployment from Workshop text.
5. Direct browser writes to GitHub.
6. Roblox export before the shared ingredient analysis pipeline is reliable.
