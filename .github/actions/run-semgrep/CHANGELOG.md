# Changelog for run-semgrep GitHub Action

All notable changes to the run-semgrep GitHub Action will be documented in this file.

## 2.0.0 - PR context from the event only

### Changed

- **Breaking:** outputs are kebab-case: `normalized-baseline`, `scan-summary`, `config-summary`,
  `scan-status`, `total-findings`, `error-count`, `warning-count` and `info-count` replace
  `normalizedBaseline`, `scanSummary`, `configSummary`, `scanStatus`, `totalFindings`, `numErrors`,
  `numWarnings` and `numInfos`.
- **Breaking:** the diff baseline is `origin/$GITHUB_BASE_REF` on `pull_request` events and
  `INPUT_BASELINE` on every other event. A push to a branch with an open PR no longer uses the PR's
  base branch.

### Removed

- **Breaking:** the GitHub API lookup of an open PR's base branch, and the `HAS_PR`, `PR_NUMBER`,
  `PR_URL`, `GITHUB_TOKEN`, `GITHUB_REF_NAME` and `GITHUB_REPOSITORY` environment variables. The action
  no longer needs a token.

## 1.0.1

### Changed

- Run the action directly on the Node.js 24 action runtime while preserving its environment and output contracts

### Fixed

- Write the info finding count to the declared `numInfos` output

## 1.0.0 - Initial Release

### Added

- Initial release of the reusable composite action for running Semgrep scans
- Inputs are passed via environment variables
- Support running on both push and pull_request events
- Standardizes baseline resolution for diff scans
- Outputs include scan summary, config summary, scan status, and finding counts
- Designed to integrate with reviewdog for annotations
