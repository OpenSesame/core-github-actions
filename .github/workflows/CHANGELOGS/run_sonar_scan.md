# Run SonarQube Scan Workflow Changelog

All notable changes to the **run_sonar_scan** callable workflow are documented in this file.

## 1.0.0

### Added

- First release of the `run_sonar_scan` reusable workflow.
- Defaults to scanning the ref that triggered the caller's workflow and optionally accepts a commit SHA, tag, or branch.
- Runs the SonarQube scan with full Git history and an explicitly mapped `SONAR_TOKEN` secret.
