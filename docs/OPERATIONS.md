# Operations and Installation

## Service Topology

1. GitHub Pages hosts the public Solid/Experimental PWA.
2. Cloudflare Workers hosts Workshop and narrow privacy-gated telemetry APIs.
3. D1 stores password verification, sessions, sanitized request records, aggregates, Workshop versions, and audit events.
4. KV may store public configuration, last-known-good metadata, and kill switches.
5. GitHub Actions polls sanitized aggregates and creates review artifacts; it does not receive photos or raw quarantined prompts.

The public editor must not depend on Cloudflare. Backend failure, quota exhaustion, maintenance, or a kill switch must leave local generation and export working.

## Environments and Deployment

The current production site deploys `main` through `.github/workflows/deploy-pages.yml`. The workspace `.git` has historically been unusable/read-only, so publishing used `/tmp/minecraft-skin-forge-publish`. Before any future release, establish which checkout is authoritative and compare its base commit with GitHub.

Deploy public assets and Worker changes separately. Workshop configuration publishing is not source deployment: it can publish only schema-validated data. Source changes continue through normal review and GitHub deployment.

## Workshop Bootstrap and Recovery

1. Deployment generates a high-entropy, one-time bootstrap token and communicates it privately.
2. The token is placed in the URL fragment, never query parameters or server logs.
3. The setup page immediately calls `history.replaceState()` to remove the fragment.
4. The first household visit chooses one shared password.
5. The Worker derives PBKDF2-SHA-256 using a random salt and stores only salt, verifier, parameters, and version.
6. Successful login creates a short-lived first-party `Secure`, `HttpOnly`, `SameSite=Strict` cookie.
7. Bootstrap is invalidated after setup.

There is no email recovery. Recovery means an operator-authenticated Worker reset followed by a new bootstrap token. Rate limits, exponential delays, session revocation, audit events, and a kill switch are required.

## Versioning, Publish, and Rollback

Workshop edits produce a structured diff and preview. Publishing creates an immutable version, updates the active pointer atomically, and records who/when without storing personal names. Restore creates a new version based on an older one rather than mutating history. Conflicting base revisions are rejected.

Public clients validate configuration schema and integrity, cache a last-known-good version, and ignore invalid or unavailable updates. The kill switch disables remote configuration or telemetry without disabling local editing.

## Free-Tier Controls

1. Track Worker requests, D1 reads/writes/storage, KV operations, and any future R2 use.
2. Apply per-installation and global quotas before provider limits.
3. Shed remote telemetry first; never degrade local generation.
4. Stop writes before free-tier ceilings and expose a local-only status.
5. Do not add R2 until retention deletion and a hard storage cutoff are automated.
6. Never place Cloudflare or GitHub administrative credentials in browser code.

## Monitoring and Request Triage

GitHub Actions may poll sanitized, non-quarantined request aggregates on a schedule. Analysis groups requests, identifies repeated unmet needs, and proposes backlog entries for human review. Simple known commands can be handled locally. No remote prompt directly edits source, configuration, a TODO, or an LLM instruction stream.

Quarantine count, rejected payloads, rate-limit events, quota state, publish failures, and restore operations should trigger operator-visible alerts without reproducing dangerous raw text in notifications.

## PWA Installation

Installation is one per device/browser profile. Updates arrive from the website through the service worker; users do not reinstall for each release.

### iPhone or iPad

1. Open the live site in Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Confirm **Add**.

### Android

1. Open the live site in Chrome.
2. Open the browser menu or installation prompt.
3. Tap **Install app** or **Add to Home screen**.
4. Confirm installation.

This is a web app, not a sideloaded APK. **Install from unknown sources is not required.** Parental controls may restrict adding web apps or camera/photo permissions, which a parent can approve through normal browser/device settings.

## Incident Rules

1. Suspected photo transmission: disable the endpoint immediately and preserve only non-sensitive operational evidence.
2. Prompt-injection surge: enable telemetry kill switch, retain quarantined records only under policy, and rotate exposed secrets if any.
3. Workshop compromise: revoke sessions, disable publishing, restore last-known-good configuration, rotate bootstrap/password state, and audit versions.
4. Quota risk: disable remote writes before charges can occur.
5. Bad public deployment: roll back GitHub Pages to the last verified commit; do not use Workshop configuration to patch executable behavior.
