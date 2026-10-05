# Run SonarQube Scan Workflow Changelog

All notable changes to the **run_sonar_scan** callable workflow are documented in this file.

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
