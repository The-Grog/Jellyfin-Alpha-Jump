# v0.5.2.0 — release notes

Release preparation: 2026-10-28. Code merged in PR #23 and tagged v0.5.2.0; manifest PR #24 triggers checksum-verified publication. No server installation or restart was performed.

## Changes

- Target Jellyfin 12.2 (minimum ABI 12.2.0.0).
- Keep dashboard Save disabled until configuration loads successfully and while loading/saving. Reject submissions after failed loads and duplicate submissions.
- Before publishing a draft release, download its ZIP and SHA-256 sidecar. Require ZIP MD5 to match the manifest and SHA-256 to match the sidecar; abort publication on mismatch.
- Select/create the release-manifest branch before generating changes. Check for a missing pull request even if no new manifest commit is needed.

Historical manifest ABIs, URLs, checksums, and published assets are unchanged. Keyboard/backdrop behavior is unchanged. The README feasibility/findings section is retained.

## Validation

- Local Node suite: 103 passed, including production dashboard failed-load/duplicate-submit checks and release checksum verification/corruption checks.
- Release ABI validation: passed for 12.2.0.0.
- Whitespace validation: passed.
- Hosted CI: Node tests, .NET build/tests, ABI validation, and CodeQL passed. Draft ZIP MD5 and SHA-256 verified against the manifest and sidecar. Served-browser validation and full retry rehearsals remain unperformed.

## Release checklist (original preparation)

- Run Release .NET build/tests with the 12.2 dependencies available.
- Check failed-load and successful-save flows in Jellyfin Web.
- Exercise existing-branch/no-new-commit PR recovery and checksum rejection in a controlled workflow test.
- Run normal CI and review the release notes. Publish through the existing draft/manifest-PR workflow only after approval.

Local .NET test attempt on 2026-10-28: the test-platform host failed during startup; zero tests ran. Hosted CI subsequently completed the .NET build and tests successfully.
