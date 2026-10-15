# Run Semgrep Scan Workflow Changelog

All notable changes to the **run_semgrep_scan** callable workflow are documented in this file.

## 2.0.0

### Changed

- **Breaking:** inputs are kebab-case: `commit-identifier`, `semgrep-config`, `semgrep-targets`,
  `extra-args`, `semgrep-version`, `fail-severity`, `semgrep-scan-mode`, `baseline-ref`,
  `reviewdog-filter-mode` and `reviewdog-reporter`. Outputs are `total-findings`, `error-count`,
  `warning-count` and `info-count`.
- **Breaking:** the job is renamed from `semgrep` ("Run Semgrep") to `scan` ("Scan"), so with a caller
  job named `Semgrep` the check reads `Semgrep / Scan`.
- **Breaking:** PR context comes only from the event. A push to a branch with an open PR is scanned
  against `baseline-ref`, reported with `github-check`, and gets no PR comment.
- **Breaking:** `baseline-ref` defaults to `origin/<default branch>` instead of `origin/main`.
- **Breaking:** `reviewdog-filter-mode` defaults to `added` instead of `nofilter`.
- **Breaking:** workflow-level permissions are `{}`, and the job requests `contents: read`,
  `pull-requests: write` and `checks: write`, so the caller job must grant them.
- `commit-identifier` is optional and defaults to the triggering ref.
- Uses `run-semgrep` 2.0.0. The checkout no longer persists credentials.

### Removed

- **Breaking:** the `pr-open-check` lookup and the push-with-open-PR handling.
- **Breaking:** the `cancel_in_progress` input and the workflow's own `concurrency` block. Callers
  set concurrency for their whole CI workflow.
- **Breaking:** the `workflow_dispatch` trigger and its duplicated inputs. The workflow had never been
  dispatched.
- The `baseline` scan mode from the documentation. It never added a baseline and ran a full scan.

## 1.2.0

### Changed

- Updated the workflow job from Ubuntu 24.04 to Ubuntu 26.04.

## 1.1.0

### Changed

- Pinned the workflow job to Ubuntu 24.04 for a stable, versioned runner contract.

## 1.0.4

### Changed

- Bumped `upsert-pr-comment` from `1.0.0` (which used the deprecated Node 20 runtime)
  to `1.0.1` (Node 24), pinned by commit SHA.
- Bumped Reviewdog from `0.20.3` to `0.21.2`.
- Pinned the default Semgrep version to `1.178.0` for reproducible scans while preserving the
  `semgrep_version` override.

## 1.0.3

### Changed

- Pinned the `run-semgrep` action to the immutable SHA from its Node 24 upgrade.
- Removed redundant Node setup and npm dependency installation; the JavaScript action uses the
  GitHub Actions Node 24 runtime and has no npm dependencies.

### Fixed

- Read the action's declared `numInfos` and `scanSummary` outputs throughout the workflow.
- Hardened Semgrep installation and job-summary shell handling so values remain intact.

## 1.0.2

### Changed

- Pinned `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `reviewdog/action-setup`, and `actions/github-script` to Node 24-compatible releases by commit SHA (with version comments), addressing the GitHub Node 20 Actions runtime deprecation (CORE-5974).

## 1.0.1

### Changed

- Updated workflow to support cross-repository usage by repo qualifying the internal composite action calls.

## 1.0.0

### Added

- First official release of the `run_semgrep_scan` workflow.
- Supports both full and diff/baseline scan modes.
- Configurable via `workflow_call` inputs for rulesets, targets, fail severity, and more.
- Integrates with PRs and pushes, posting findings to Actions UI, Job Summary, PR comments, and Reviewdog.
- Outputs scan results, config summary, and normalized baseline for downstream jobs.
- Replaces previous usage under the `legacy-stable` tag with a versioned, documented workflow.
  - Refactored code for maintainability.
  - Added support for specifying Semgrep version, multiple rulesets, specific targets, and extra arguments.
  - Note: Some input defaults have changed and may be breaking for consumers.
