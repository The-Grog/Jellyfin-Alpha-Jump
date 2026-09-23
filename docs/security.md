# Repository security controls

Alpha Jump uses repository rulesets and workflow configuration to protect the
plugin DLL users install.

## Source and release controls

- `main` requires a pull request, linear history, resolved review threads, and
  the `validate` CI job on the latest base branch. The required approval count
  is intentionally zero while the repository has one maintainer.
- The repository owner may bypass these controls. The GitHub Actions integration
  has a narrow `main` bypass because the release workflow commits the generated
  checksum and URL to `manifest.json`; ordinary workflows have read-only token
  permissions.
- `v*` tags are protected from creation, update, deletion, and force updates;
  only the repository owner bypasses that rule.
- The release workflow creates a draft with all assets, writes the manifest,
  then publishes the draft. This order is compatible with immutable releases.

## Automation and disclosure

- All workflow actions are full commit-SHA pinned. Dependabot opens weekly
  update PRs for GitHub Actions and NuGet; Jellyfin package changes require
  maintainer ABI review and are never auto-merged.
- CodeQL scans C# and JavaScript/TypeScript on `main`, pull requests, and a
  weekly schedule. Code-scanning findings are reviewed before making any
  code-scanning rule a merge requirement.
- Secret scanning and push protection are enabled in GitHub. Private
  vulnerability reporting is enabled; see [SECURITY.md](../SECURITY.md).

## Maintenance

Keep default Actions permissions read-only. New workflows requiring write access
must declare the smallest explicit permission set. New third-party Actions must
be reviewed and pinned to a full commit SHA.
