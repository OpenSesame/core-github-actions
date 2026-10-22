# Trigger a Workflow and Wait Workflow Changelog

All notable changes to the **trigger_workflow_and_wait** reusable workflow are documented in this
file.

## 1.0.0

### Changed

- **Breaking:** renamed inputs `workflow_file`, `wait_interval` and `client_payload` to `workflow-file`,
  `wait-interval` and `client-payload`, and outputs `downstream_run_id` and `downstream_html_url` to
  `downstream-run-id` and `downstream-html-url`.
- **Breaking:** the workflow now declares `permissions: {}`; callers no longer need to grant
  `id-token: write` or `contents: read`.
- **Breaking:** `client-payload` must be a JSON object.
- `commit-identifier` is documented as a branch or tag, the refs the dispatch API accepts.

### Fixed

- The downstream run is now the one created by this dispatch, read from the dispatch response
  (`return_run_details: true`). Previously the workflow picked any new `workflow_dispatch` run of
  the target workflow, so a concurrent dispatch from another caller could be waited on instead.
- The workflow fails with an error when the dispatch response has no run ID, rather than guessing.

### Removed

- The two-minute run listing and the 60-attempt run-discovery loop.

## 0.2.0

### Changed

- Updated the workflow job from Ubuntu 24.04 to Ubuntu 26.04.

## 0.1.0

### Changed

- Pinned the workflow job to Ubuntu 24.04 for a stable, versioned runner contract.

## 0.0.1

### Added

- Established the first versioned baseline of the existing reusable workflow.
- Documented the current inputs, secret, outputs, permissions, run-discovery behavior, polling, and
  downstream-workflow side-effect warning.

This release records existing behavior and does not change the workflow implementation.
