# Privacy and Safety

## Principles

My Avatars is designed for children and families. Local creation is the default, not a degraded privacy mode. The app must explain what leaves the device in age-appropriate language and remain fully usable when remote collection is disabled.

## Data Boundaries

Normal face, hair, and outfit photos, user highlights/masks, recipes, canvas data, generated skins, names, phone numbers, email addresses, URLs, account information, and device fingerprints never leave the device. First names may be used in the local UI but are not uploaded or hashed for backend identity.

If remote request collection is enabled, the backend uses a random 128-bit installation ID. This is not an account and must not be derived from a name, IP address, or hardware fingerprint. A server-side block may deny abusive IDs, but reinstalling may create a new ID.

## Experimental Requests

The intended experience records Experimental text automatically without a separate Send/Feedback button. This collection is **operationally disabled** until all of these gates pass:

1. Clear disclosure and valid consent/opt-in appropriate to the audience.
2. Strict payload allowlist and size limits.
3. Removal or rejection of names, contact information, URLs, account data, and obvious secrets.
4. Scope classification limited to character/avatar creation and studio UI requests.
5. Prompt-injection, abuse, and exfiltration detection.
6. Quarantine that prevents delivery to LLMs, TODO automation, or configuration publishing.
7. Per-installation and global rate/quota limits.
8. Seven-day raw-text deletion with auditable cleanup.
9. User-visible collection status and deletion controls.
10. A kill switch that does not affect local generation.

Sanitization is defense in depth, not permission to collect prohibited data. The browser should avoid transmitting disallowed fields at all; the Worker validates again.

## Retention

1. Raw permitted request text: maximum seven days.
2. Quarantined text: shortest operational interval needed for investigation, never forwarded automatically, then deleted.
3. De-identified aggregates: retain only while useful for product prioritization.
4. Authentication/audit records: retain according to security need without names or content payloads.
5. Local photos and avatars: controlled by the user through browser/device storage and explicit deletion.

## Automated Triage

The pipeline is observe, sanitize, classify, quarantine if needed, aggregate, analyze, and propose. It may recognize simple local commands without remote access. It may create a reviewable proposal from sanitized aggregate demand. It may not let a user prompt become system instructions, code, configuration, a deployed UI change, a GitHub write, or an unreviewed TODO.

Alerts contain identifiers, timestamps, reason codes, and counts, not the dangerous raw prompt. Access to quarantined content is restricted and logged.

## Research Contribution

Collecting photos and resulting skins could eventually support evaluation or a compact browser model, but the data would be sensitive child biometric/appearance data and may not be adequate training data without curated targets and rights. It is not part of normal telemetry.

Any future Research Contribution mode requires a separate, explicit opt-in; a plain-language purpose; parental/legal review; data-quality criteria; revocation and deletion; access controls; retention limits; and an explanation that declining has no product penalty. It must never be enabled by default or bundled with Experimental requests.

## Workshop Safety

Workshop uses a password rather than IP location. It publishes constrained data only. Password verifiers use salted PBKDF2-SHA-256; plaintext passwords are never stored or logged. Bootstrap tokens are one-time, fragment-based, removed immediately, and invalidated after setup. Sessions use secure same-origin cookies.

Household access does not bypass the content, prompt-injection, schema, preview, versioning, quota, or kill-switch controls.

## Explicit Prohibitions

1. Do not publish `face-comparison.html`; it embeds personal photographs.
2. Do not send photos to hosted AI APIs in the normal product.
3. Do not store GitHub, Cloudflare, Azure, or AWS credentials in the PWA.
4. Do not use IP addresses as household authentication or persistent identity.
5. Do not claim perceptual likeness from the retired self-referential score.
6. Do not enable remote logging merely because the endpoint exists.
