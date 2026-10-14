# pr-open-check action Changelog

All notable changes to the **pr-open-check** composite action will be documented in this file.

## 2.1.0 - Match the PR head branch

### Added

- Optional `head-ref` input. When set, only an open PR whose head branch equals `head-ref` and whose
  head repository is the current repository is returned, so a push to a branch without a PR is not
  matched to another branch's PR that contains the same commit, and fork PRs with the same branch name
  are ignored. When unset, the action keeps the 2.0.0 behavior and returns the first open PR
  associated with the commit.
- Unit tests that run the action script against fixture API responses.

### Fixed

- A GitHub API response that is not a JSON array (rate limit or error JSON, HTML, empty body) no longer
  fails the step. The action emits a warning and returns `pr_exists=false` with empty `pr_number` and
  `pr_url`.
- The PR lookup requests 100 results per page instead of the API default of 30, so a commit shared by
  many PRs no longer hides the matching branch's PR beyond the first 30.

## 2.0.0 - Detect via API instead of CLI

### Added

- New required input: commit-identifier
- Guard for missing curl dependency

### Changed

- Action now detects open PRs containing a specific commit, not by branch name.
- PR search is performed using the GitHub API (via curl + jq), replacing the previous gh CLI approach.

### Removed

- branch input removed (no longer needed).
- All usage of gh CLI removed.

## 1.0.0 — Initial Release

- Added support for detecting whether a branch has an open pull request in the same repository.
- Outputs:
  - `pr_exists` — boolean indicating detection result.
  - `pr_number` — PR number if found.
  - `pr_url` — PR URL if found.
- Added guards for missing `gh` and `jq` dependencies.
- Added fallback behavior to safely return `pr_exists=false` if tooling is unavailable.
- Added support for optional `branch` input (defaults to `github.ref_name`).
- Added documentation on usage, dependencies, and limitations.
