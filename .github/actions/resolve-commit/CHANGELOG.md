# Resolve Commit Changelog

All notable changes to the `resolve-commit` composite action are documented in this file.

## 1.0.0

### Added

- Resolve `commit-identifier`, a SHA, short SHA, tag or branch, to the full SHA of the commit it
  names through the GitHub API, and output it as `sha`. An empty `commit-identifier` resolves
  `github.sha`.
- Fail with an `Unresolved commit` error when the identifier names no commit in `repository`, with
  the API's reason, or when the lookup returns anything but a 40-character SHA.
