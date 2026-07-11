# Mobile Avatar Studio Delivery Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dependable installable Solid avatar studio, then add Experimental commands, a free feedback/Workshop backend, and gated photo research without weakening Solid mode.

**Architecture:** Four independently deployable phases share a versioned avatar recipe and deterministic Minecraft compositor. Solid remains browser-only; Experimental remote capabilities fail closed and never block local generation.

**Tech Stack:** Static HTML/CSS/ES modules, Canvas, Three.js, IndexedDB, Service Worker, Node test runner, Cloudflare Workers/D1/KV/R2, GitHub Pages and Actions.

---

## Plan Set

1. `2026-07-10-solid-avatar-studio-implementation.md`
2. `2026-07-10-experimental-command-engine-implementation.md`
3. `2026-07-10-free-feedback-workshop-backend-implementation.md`
4. `2026-07-10-photo-fidelity-spike-implementation.md`

## Promotion Order

- [ ] **Gate 1:** Ship Solid only after preset-only generation, Classic/Slim validation, 2D download, viewer failure, IndexedDB failure, reload, and offline smoke checks pass.
- [ ] **Gate 2:** Ship the Experimental toggle and local commands with remote endpoints disabled. Solid must produce byte-identical PNG output before and after this change.
- [ ] **Gate 3:** Deploy the Worker on free-only resources, initialize the Workshop password with the private one-time setup URL, and enable prompt telemetry after sanitization/quarantine tests pass.
- [ ] **Gate 4:** Enable Workshop preview for authenticated sessions, then verify public Experimental promotion and rollback. Solid must ignore all remote configuration.
- [ ] **Gate 5:** Run the photo-fidelity spike. Do not promote photo-derived ingredients unless blind preference, mobile runtime, privacy, accessibility, and Minecraft correctness thresholds all pass.
- [ ] **Gate 6:** Enable Research Contribution only after deletion, consent-versioning, quota cutoff, and storage-retention tests pass.

## Deployment Commits

```text
feat: add solid mobile avatar studio
feat: add local experimental instructions
feat: add free feedback and workshop backend
feat: add password-gated workshop publishing
test: add photo fidelity evaluation spike
feat: enable consented research contribution
```

Each commit must be deployable or intentionally leave a feature behind a default-off flag. Never combine a Solid regression fix with backend enablement.
# Status: Implementation Reference Under Final Solution

Use this roadmap only with `docs/FINAL_SOLUTION.md`, `docs/PRIVACY_AND_SAFETY.md`, and `docs/TESTING_AND_RELEASE.md`. Those documents override earlier required-photo, IP-gated, shared-module, telemetry, or viewer assumptions.

