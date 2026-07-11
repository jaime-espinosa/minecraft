# Documentation Index

This index separates final decisions from historical exploration. If documents conflict, use the precedence below.

## Authority Order

1. [FINAL_SOLUTION.md](FINAL_SOLUTION.md) is the normative product and architecture specification.
2. [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md) controls collection, retention, child safety, and prompt handling.
3. [OPERATIONS.md](OPERATIONS.md) controls deployment, quotas, Workshop access, recovery, and monitoring.
4. [TESTING_AND_RELEASE.md](TESTING_AND_RELEASE.md) defines release gates and browser evidence.
5. `docs/superpowers/plans/` provides implementation sequencing; a plan cannot override items 1-4.
6. [PROJECT_HISTORY.md](PROJECT_HISTORY.md), reviews, and earlier designs are historical evidence only.

## Core Documents

1. [FINAL_SOLUTION.md](FINAL_SOLUTION.md): approved Mode-Isolated Modular Workbench, contracts, routes, invariants, and delivery boundary.
2. [PROJECT_HISTORY.md](PROJECT_HISTORY.md): what was built, observed, tried, rejected, and learned.
3. [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md): local-photo boundary, telemetry gate, sanitization, quarantine, and retention.
4. [OPERATIONS.md](OPERATIONS.md): free-service topology, authentication, publishing, rollback, quotas, and PWA installation.
5. [TESTING_AND_RELEASE.md](TESTING_AND_RELEASE.md): renderer, privacy, Workshop, PWA, and deployment gates.
6. [HANDOFF.md](HANDOFF.md): concise continuation context for another agent.

## Plans and Reviews

1. `docs/superpowers/specs/2026-07-10-mobile-avatar-studio-design.md` records the earlier mobile design. It is superseded where it conflicts with the final solution.
2. `docs/superpowers/plans/2026-07-10-mobile-avatar-studio-roadmap.md` and the detailed plans describe staged implementation.
3. [reviews/gemini-mobile-ui-review.md](reviews/gemini-mobile-ui-review.md) is the Gemini UI review.
4. [reviews/sol-ultra-final-design-review.md](reviews/sol-ultra-final-design-review.md) is the final Sol architecture review.
5. [reviews/multi-llm-architecture-review.md](reviews/multi-llm-architecture-review.md) summarizes the earlier panel review.

## Sensitive and Generated Files

Never publish `face-comparison.html`; it embeds personal photographs. `mark-minecraft-skin.png` is a hand-authored playable reference, not proof that the automatic generator can reproduce the same likeness. Keep downloaded skins, screenshots, browser captures, and fidelity reports out of source control unless they are deliberately approved test fixtures.
