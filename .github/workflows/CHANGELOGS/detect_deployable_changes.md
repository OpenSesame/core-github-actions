# Detect Deployable Changes Workflow Changelog

All notable changes to the **detect_deployable_changes** reusable workflow are documented in this
file.

## 1.0.0

### Added

- First release of the `detect_deployable_changes` reusable workflow.
- One job, `detect` ("Detect"), that checks out the commit with full history and runs
  `detect-deployable-changes` 1.0.0, with `actions: read` and `contents: read`.
  - It checks out the pull request's head in `pull-request` mode and `github.sha` in `merge` mode.
- Inputs: every action input except `github-token`, plus `timeout-minutes` (default 50), which
  stays above the action's default 40-minute wait.
- Outputs: `should-deploy`, `reason` and `verified-sha`.
