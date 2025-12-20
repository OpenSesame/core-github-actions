# pr-open-check action Changelog

All notable changes to the **pr-open-check** composite action will be documented in this file.

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
