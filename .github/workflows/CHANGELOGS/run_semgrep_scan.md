# Run Semgrep Scan Workflow Changelog

All notable changes to the **run_semgrep_scan** callable workflow are documented in this file.

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
