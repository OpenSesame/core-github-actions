# Changelog for run-semgrep Composite Action

All notable changes to the run-semgrep composite GitHub Action will be documented in this file.

## 1.0.0 - Initial Release

### Added

- Initial release of the reusable composite action for running Semgrep scans
- Inputs are passed via environment variables
- Support running on both push and pull_request events
- Standardizes baseline resolution for diff scans
- Outputs include scan summary, config summary, scan status, and finding counts
- Designed to integrate with reviewdog for annotations
