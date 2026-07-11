# Project History and Decision Record

## Original Goal

Skin Forge began as a free GitHub Pages tool where a user uploads a photograph and receives a downloadable, playable Minecraft skin plus a 3D preview. Early work established that a modern skin is not a resized portrait: the tool must decompose appearance into head, hat, torso, arms, legs, and outer layers, then paint the correct `64 x 64` texture regions.

## Shipped Browser Prototype

The static prototype was implemented in `index.html`, `styles.css`, `app.js`, and `viewer.js`. It performs local Canvas processing, exports a PNG, and renders a Three.js model. Iterations added:

1. A larger bottom preview and visible `64 x 64` sheet.
2. Crop position and zoom.
3. Classic and Slim arms.
4. Automatic and manual palettes.
5. Hair style and curl controls.
6. Expressions and accessories.
7. Correct duplication/mirroring of body regions.
8. Hair on the hat layer rather than painted directly into the face.

The live production baseline is commit `ded8b5299eb8216ae1b141199a561c8ae36ae27f`.

## Face-Fidelity Investigation

Downloaded `PXL_2*` reference photographs were used locally to isolate Mark and compare three outputs: the original face, a hand-authored Minecraft interpretation, and the site result. `mark-minecraft-skin.png` demonstrated that a recognizable, playable skin can be authored with deliberate pixel choices and a separate hat layer.

The investigation found that naive crop-and-downsample behavior includes too much of the photograph and loses identity. The automatic result differed substantially from the hand-authored target. Useful pixel-art techniques include semantic palette selection, controlled contrast, symmetry with a few identity-bearing asymmetries, landmark-aware placement, hair silhouette on the hat layer, and evaluating the final composite rather than the base `8 x 8` face alone.

The displayed `0.9327` face score compared the system too closely to its own derivation. It was self-referential, not an independent measure of likeness, and is retired as evidence.

## Approaches Considered

1. **Single portrait decomposition:** simple and private, but unreliable for occlusion, hair, clothing, pose, and background separation.
2. **Manual highlighting:** useful optional guidance, especially for a shirt or outfit, but too burdensome as a required workflow.
3. **Portable face landmarks and segmentation:** promising browser-local components, but they add model weight and do not by themselves solve artistic quantization.
4. **Hosted generative AI:** potentially capable, but conflicts with child-photo privacy, predictable cost, offline use, and the 100% free requirement.
5. **Small browser model:** viable only after collecting lawful, representative training data and proving that size, latency, fidelity, and licensing fit the PWA. It is not required for v1.
6. **Multiple photos:** improves consensus for face, hair, and outfit, but ideal photos are difficult to gather outside a guided phone experience.
7. **Phone app:** unnecessary initially. An installable PWA provides camera access and a home-screen experience without app stores or unknown-source installation.
8. **Roblox support:** plausible future product work, but its geometry, assets, and export rules are a separate renderer rather than a small Minecraft toggle.

## Mobile and Experimental Evolution

The proposed mobile flow changed from required scanning to optional ingredients with useful defaults. A user can start immediately, reuse previous ingredients, or open a focused capture/editor for Face, Hair, Outfit, and other details. Mirrors are acceptable, and a user may photograph a garment directly. Finger highlighting is optional.

Solid became the dependable editor. Experimental became an isolated route for guided capture, local models, and a text interface. The text interface should act on simple in-scope requests locally without requiring a Send button. Remote request collection was proposed to discover unmet needs and feed triage and backlog decisions.

## Telemetry and Safety Decisions

Initial ideas included GitHub-backed logs, event-driven monitoring, salted hashes, IP-based household access, and photo/result collection for model training. Review changed these decisions:

1. GitHub is not a write API for untrusted browsers; credentials must never be shipped to clients.
2. IP restriction is brittle and was replaced by one shared password for Workshop.
3. First names remain local; identity uses random backend IDs rather than reversible or guessable name hashes.
4. Photos and skins are not normal telemetry.
5. Training-data contribution requires a separate explicit opt-in and is not part of the approved initial backend.
6. Prompts must be sanitized, scope-classified, rate-limited, quarantined on injection/abuse signals, and excluded from automatic LLM or TODO pipelines when quarantined.

## Architecture Reviews

The Claude/Codex/Vibe panel agreed that likeness was unproven and required a 15-20 case renderer spike with independent blind comparison. Gemini 3.1 Pro High recommended a Modular Workbench and a complete DOM rewrite first. GPT-5.6 Sol with ultra reasoning accepted the destination but rejected DOM-first sequencing: define contracts, enforce Minecraft invariants, and isolate the viewer before rewriting screens.

The accepted synthesis is the Mode-Isolated Modular Workbench in `FINAL_SOLUTION.md`. Sol ran in thread `019f4ea4-98c7-7462-9ee1-cdc4af348d7e`. A statement in the raw Sol artifact that Sol Ultra was unavailable is incorrect; the session was explicitly launched with `gpt-5.6-sol` and `ultra` reasoning.

## Current Boundary

Documentation and implementation plans exist, but the final architecture is not deployed. The production app remains the earlier static prototype. `face-comparison.html` contains embedded personal image data and must never be published.
