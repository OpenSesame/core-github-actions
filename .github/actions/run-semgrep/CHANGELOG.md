# Changelog for run-semgrep GitHub Action

All notable changes to the run-semgrep GitHub Action will be documented in this file.

## 1.0.1

### Changed

- Run the action directly on the Node.js 24 action runtime while preserving its environment and output contracts

## 1.0.0 - Initial Release

### Added

- Initial release of the reusable composite action for running Semgrep scans
- Inputs are passed via environment variables
- Support running on both push and pull_request events
- Standardizes baseline resolution for diff scans
- Outputs include scan summary, config summary, scan status, and finding counts
- Designed to integrate with reviewdog for annotations
