# Free Feedback and Workshop Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide zero-cost prompt telemetry, quarantine, first-login Workshop password setup, versioned configuration publishing, rollback, and sanitized GitHub triage.

**Architecture:** A Cloudflare Worker exposes narrow JSON endpoints. D1 is authoritative for users, prompt records, authentication verifier, and config versions; remote failure never affects local avatar work.

**Tech Stack:** Cloudflare Workers, Web Crypto, D1, optional KV/R2, Wrangler, Node tests, GitHub Actions.

---

### Task 1: Scaffold the Worker and schema

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/src/worker.js`
- Create: `worker/migrations/0001_initial.sql`
- Create: `worker/tests/router.test.js`

- [ ] **Step 1: Test `GET /api/health` and 404 JSON responses**
- [ ] **Step 2: Create D1 tables `users`, `prompts`, `quarantine`, `workshop_auth`, `workshop_configs`, and `audit_events` with foreign keys and timestamp indexes**

```sql
CREATE TABLE users (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, blocked_at INTEGER);
CREATE TABLE prompts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), raw_text TEXT, sanitized_text TEXT NOT NULL, outcome TEXT NOT NULL, parser_version TEXT NOT NULL, app_version TEXT NOT NULL, created_at INTEGER NOT NULL, raw_expires_at INTEGER NOT NULL);
CREATE TABLE quarantine (id TEXT PRIMARY KEY, user_id TEXT, encrypted_raw TEXT, category TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE workshop_auth (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, verifier TEXT NOT NULL, password_version INTEGER NOT NULL, initialized_at INTEGER NOT NULL);
CREATE TABLE workshop_configs (version INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL CHECK(scope IN ('preview','public')), config_json TEXT NOT NULL, created_at INTEGER NOT NULL, actor_user_id TEXT);
```

- [ ] **Step 3: Run Worker tests and local D1 migration**
- [ ] **Step 4: Commit with `feat: scaffold free skin forge worker`**

### Task 2: Implement safe first-login password setup

**Files:**
- Create: `worker/src/auth.js`
- Create: `worker/tests/auth.test.js`
- Modify: `worker/src/worker.js`

- [ ] **Step 1: Test invalid bootstrap token, one successful initialization, second setup rejection, correct/incorrect password, expiration, rotation, and rate limiting**
- [ ] **Step 2: Implement PBKDF2-SHA-256 with a random 16-byte salt and at least 310,000 iterations using Web Crypto**
- [ ] **Step 3: Compare derived bytes in constant time; store only salt/verifier in D1**
- [ ] **Step 4: Sign a versioned 12-hour session payload with `SESSION_SIGNING_KEY`; return it only in an `HttpOnly; Secure; SameSite=Strict; Path=/api/workshop` cookie**
- [ ] **Step 5: Implement `/api/workshop/setup`, `/login`, `/logout`, and `/session`; exclude request bodies and attempted passwords from logs**
- [ ] **Step 6: Add `scripts/create-workshop-bootstrap.mjs` that generates a 32-byte token, prints the private setup URL locally, and writes only its SHA-256 verifier through `wrangler secret put`**
- [ ] **Step 7: Run tests and commit with `feat: add first-login workshop password`**

### Task 3: Sanitize, quarantine, and retain prompts

**Files:**
- Create: `worker/src/sanitize.js`
- Create: `worker/src/telemetry.js`
- Create: `worker/tests/sanitize.test.js`
- Modify: `worker/src/worker.js`

- [ ] **Step 1: Add fixtures for phone, email, account numbers, URLs, secrets, injection phrases, code, avatar commands, UI commands, and unrelated requests**
- [ ] **Step 2: Implement strict 500-character UTF-8 input, JSON schema validation, PII redaction, category classification, and SHA-256 fingerprinting**
- [ ] **Step 3: Write normal records to `prompts`; write suspicious records to `quarantine`; never return raw content from public endpoints**
- [ ] **Step 4: Add a daily Cron handler that sets expired `raw_text` to NULL after seven days and records aggregate counts**
- [ ] **Step 5: Add per-user and coarse network rate limits plus blocked-user rejection**
- [ ] **Step 6: Run tests and commit with `feat: collect sanitized experimental requests`**

### Task 4: Add versioned Workshop configuration

**Files:**
- Create: `worker/src/workshop.js`
- Create: `worker/tests/workshop.test.js`
- Modify: `worker/src/worker.js`

- [ ] **Step 1: Test authentication, schedule/kill switch, operation schema, preview append, public promotion, undo, restore, invalid atomic rejection, and Solid endpoint absence**
- [ ] **Step 2: Reuse the client operation allowlist as a versioned JSON schema artifact; reject extra keys and executable strings**
- [ ] **Step 3: Implement authenticated `/api/workshop/config`, `/publish`, `/undo`, and `/restore/:version`**
- [ ] **Step 4: Implement public read-only `/api/config/public` and authenticated `/api/config/preview` with ETags**
- [ ] **Step 5: Record actor, version, operation fingerprint, and result in `audit_events` without prompt text**
- [ ] **Step 6: Run tests and commit with `feat: add workshop preview publish and rollback`**

### Task 5: Connect the browser without weakening local operation

**Files:**
- Create: `src/telemetry/client.js`
- Create: `src/workshop/auth-client.js`
- Modify: `index.html`
- Modify: `app.js`

- [ ] **Step 1: Queue at most 50 prompt records in IndexedDB while offline and expire unsent records after seven days**
- [ ] **Step 2: Generate/store the anonymous 128-bit user ID through the Worker; keep first names local**
- [ ] **Step 3: Submit every Experimental command after local parsing; never give the telemetry client access to photo, mask, or skin canvases**
- [ ] **Step 4: Add first-setup, login, logout, session-expired, and password-reset UI states**
- [ ] **Step 5: Browser-test Worker outage, blocked user, expired session, malformed config, and queue overflow**
- [ ] **Step 6: Commit with `feat: connect experimental feedback and workshop`**

### Task 6: Add GitHub triage without publishing raw prompts

**Files:**
- Create: `scripts/poll-feedback.mjs`
- Create: `.github/workflows/feedback-triage.yml`
- Create: `docs/feedback/triage.json`
- Modify: `.gitignore`

- [ ] **Step 1: Make the script fetch only sanitized aggregates from a protected admin endpoint and validate the response schema**
- [ ] **Step 2: Cluster exact normalized intents deterministically; output counts, first/last seen, supported status, safe examples, quarantine counts, and proposed lane (`automatic`, `review`, `backlog`)**
- [ ] **Step 3: Schedule the Action every six hours and permit it to commit only `docs/feedback/triage.json` when changed**
- [ ] **Step 4: Add sanitized `repository_dispatch` alarms containing category, fingerprint, and count only**
- [ ] **Step 5: Test a malicious aggregate payload and confirm it remains inert JSON data**
- [ ] **Step 6: Commit with `ci: add sanitized feedback triage`**

### Task 7: Enforce zero-cost shutdown

**Files:**
- Create: `worker/src/quota.js`
- Create: `worker/tests/quota.test.js`
- Modify: `worker/src/worker.js`
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Test warning, telemetry-disable, and research-disable thresholds using injected usage counters**
- [ ] **Step 2: Reject remote writes before configured free-plan ceilings while keeping health/config reads available**
- [ ] **Step 3: Document exact free-plan bindings, secrets, bootstrap command, rotation, kill switch, rollback, and teardown**
- [ ] **Step 4: Deploy Worker/D1 without R2 enabled; initialize password from the private setup URL**
- [ ] **Step 5: Commit with `ops: enforce zero-cost backend limits`**

