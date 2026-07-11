# Multi-LLM Architecture Review

## Scope

An early architecture panel used Claude, Codex, and Vibe to review the static photo-to-Minecraft-skin approach and the proposal for a local-first mobile experience. This record preserves the durable conclusions rather than treating model output as authority.

## Consensus Findings

1. The automatic generator had not demonstrated perceptual likeness.
2. The displayed fidelity score was self-referential and unsuitable as evidence.
3. A Minecraft skin is a semantic composition problem, not a whole-image resize.
4. Hair silhouette belongs on the hat/outer-head layer.
5. Browser-local processing best matches child privacy, cost, and offline goals.
6. Three.js should not be on the critical generation/export path.
7. A small renderer/evaluation spike should precede large UI or AI investment.

## Recommended Evidence

The panel recommended a fixed 15-20 case set, independently authored reference skins, decoded-pixel conformance checks, and blinded comparisons among the photograph, target, and generated result. Face, hair, outfit, and technical validity should receive separate scores. Improvements should be measured across repeated develop/test/observe/analyze cycles and stopped when gains asymptote.

## Architecture Implications

The generator should become a deterministic domain kernel with versioned recipes and validated output. Optional landmarks, segmentation, and multi-photo consensus belong behind an Experimental boundary. The public editor must work without hosted AI. Hosted inference and training-data collection were not justified for v1.

## Unresolved at the Time

The panel did not settle the final mobile navigation, Workshop authentication, telemetry retention, or implementation order. Later Gemini and Sol reviews addressed these topics. `docs/FINAL_SOLUTION.md` contains the accepted synthesis and supersedes any conflicting panel suggestion.
