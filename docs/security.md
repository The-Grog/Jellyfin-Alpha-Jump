# Repository security controls

Alpha Jump uses repository rulesets and workflow configuration to protect the
plugin DLL users install.

## Source and release controls

- `main` requires a pull request, linear history, resolved review threads, and
  the `validate` CI job on the latest base branch. The required approval count
  is intentionally zero while the repository has one maintainer.
- The repository owner may bypass these controls. GitHub does not permit the
  GitHub Actions integration as a repository-ruleset bypass actor for this
  personal repository, so workflows never push directly to `main`.
- `v*` tags are protected from creation, update, deletion, and force updates;
  only the repository owner bypasses that rule.
- The release workflow creates a draft with all assets, then opens a manifest
  pull request. The separate publish workflow releases that draft only after
  the protected manifest PR is merged. This order is compatible with immutable
  releases.

## Automation and disclosure

- All workflow actions are full commit-SHA pinned. Dependabot opens weekly
  update PRs for GitHub Actions and NuGet; Jellyfin package changes require
  maintainer ABI review and are never auto-merged.
- CodeQL scans C# and JavaScript/TypeScript on `main`, pull requests, and a
  weekly schedule. Its C# job builds the test project between initialization and
  analysis so CodeQL can extract the server plugin sources. Code-scanning
  findings are reviewed before making any code-scanning rule a merge
  requirement.
- Secret scanning and push protection are enabled in GitHub. Private
  vulnerability reporting is enabled; see [SECURITY.md](../SECURITY.md).

## Maintenance

Keep default Actions permissions read-only. New workflows requiring write access
must declare the smallest explicit permission set. New third-party Actions must
be reviewed and pinned to a full commit SHA.
