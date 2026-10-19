# Run SonarQube Scan Workflow Changelog

All notable changes to the **run_sonar_scan** callable workflow are documented in this file.

## 2.0.0

### Added

- `coverage-artifact-pattern` input (default `coverage-*`). Every same-run artifact whose name matches
  is downloaded into `coverage-artifact-path`, one directory per artifact when more than one matches,
  so callers no longer need a coverage merge job or a conditional artifact-name output.
- A warning and a job summary line when no downloaded artifact contains an `lcov.info`; the scan still
  runs.
- A check that fails the job when `coverage-artifact-path` already exists with content in the
  checkout, so repository files are never reported as coverage.
- A job summary listing the downloaded coverage files.

### Changed

- **Breaking:** the job is renamed from `sonar-scan` ("Run SonarQube scan") to `scan` ("Scan"), so the
  check reads `<caller job name> / Scan`.
- **Breaking:** `coverage-artifact-path` defaults to `.sonar-coverage` instead of `.`.
- The job skips runs triggered by `dependabot[bot]` or `renovate[bot]`; callers can drop that condition.
- Workflow permissions default to none, and the job requests only `contents: read`.
- The checkout no longer persists credentials.

### Removed

- **Breaking:** the `coverage-artifact-name` input. Use `coverage-artifact-pattern`.

## 1.3.0

### Added

- Added optional `coverage-artifact-name` and `coverage-artifact-path` inputs to download a same-run coverage artifact before the SonarQube scan.

## 1.2.0

### Changed

- Updated the workflow job from Ubuntu 24.04 to Ubuntu 26.04.

## 1.1.0

### Changed

- Pinned the workflow job to Ubuntu 24.04 for a stable, versioned runner contract.
- Bumped `SonarSource/sonarqube-scan-action` from `v8.2.1` to `v8.3.0`.

## 1.0.0

### Added

- First release of the `run_sonar_scan` reusable workflow.
- Defaults to scanning the ref that triggered the caller's workflow and optionally accepts a commit SHA, tag, or branch.
- Runs the SonarQube scan with full Git history and an explicitly mapped `SONAR_TOKEN` secret.
