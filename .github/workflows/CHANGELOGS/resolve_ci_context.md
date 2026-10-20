# Resolve CI Context Workflow Changelog

All notable changes to the **resolve_ci_context** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release of the `resolve_ci_context` reusable workflow, replacing the inline
  `resolve-ci-context` job in each repository's CI workflow.
- One job, `resolve` ("Resolve"), with outputs `commit-identifier`, `should-run-ci`, `pr-exists`,
  `pr-number` and `pr-url`, and an optional `commit-identifier` input for the caller's dispatch input.
- PR context from the event on `pull_request` runs, and from `pr-open-check` 2.1.0 with
  `head-ref: github.ref_name` on pushes and dispatches to other branches.
- A fail-open lookup: a failed lookup warns and lets the push run CI.
- A "Push CI skipped" job summary that links the open PR when a push is skipped.
