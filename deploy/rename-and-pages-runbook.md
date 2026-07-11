# My Avatars rename and Pages runbook

This is a review checklist, not authorization to change remote state. Do not rename a repository, push, change Pages settings, deploy either site, or publish canonical metadata without the owner’s explicit approval.

The checked-in Pages workflow is manual-only (`workflow_dispatch`) until the rename and cutover are explicitly authorized. Do not restore an automatic `main` trigger before that gate passes.

## Proposed change

1. Record the last verified `minecraft` deployment commit and Pages configuration.
2. Rename the GitHub repository from `minecraft` to `my-avatars` and keep GitHub’s repository redirect enabled.
3. Configure GitHub Actions Pages for the renamed repository and verify the public base is exactly `/my-avatars/`.
4. Confirm `manifest.webmanifest`, service-worker registration, and the worker itself all use start URL and scope `/my-avatars/`.
5. Deploy `compat/minecraft/index.html` only as the old `/minecraft/` site after separately authorizing that deployment. It must map only the three documented hashes, drop every query parameter, and otherwise open `/my-avatars/#/studio`.
6. After both sites pass verification, publish canonical metadata for the new URL in a separately reviewed change.

## Verification gate

- Open all five public hashes under `/my-avatars/` online and after a complete offline shell install.
- Inspect Cache Storage: only the checked-in public allowlist may appear; no photo, artifact, download, generated, Workshop, or authenticated response may appear.
- Install an update, confirm it waits, keep an unsaved draft and confirm Reload is blocked, then choose Reload with no draft or migration and confirm activation.
- Test the three old recognized hashes, empty hash, unknown hash, and URLs containing query secrets. Confirm the destination contains no query.
- Confirm the Pages artifact was assembled in a temporary directory and contains exactly `deploy/pages-allowlist.txt`.
- Confirm canonical links, repository links, and the service-worker scope use the final production URL before publishing them.

## Rollback

1. Stop the new workflow and redeploy the recorded last-known-good artifact/configuration.
2. Restore the prior repository name and Pages source only with explicit owner approval.
3. Remove or revert canonical metadata and the old-site compatibility deployment together so there is one truthful destination.
4. Verify the old site, stored local data, and downloads remain usable. Never delete IndexedDB or generated user files as part of deployment rollback.
