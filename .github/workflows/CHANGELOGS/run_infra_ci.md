# Run Infra CI Workflow Changelog

All notable changes to the **run_infra_ci** reusable workflow are documented in this file.

## 1.0.2

### Changed

- Bumped `jdx/mise-action` from 5.0.0 to 5.2.5, pinned by commit SHA. The mise version it installs
  (2026.9.17) is unchanged.

## 1.0.1

### Fixed

- The `Scan GHA` job summary no longer fails the job when the repo has no inline
  `# zizmor: ignore[...]` comments.

## 1.0.0

### Added

- First release of the `run_infra_ci` reusable workflow, with an optional `commit-identifier` input.
- Jobs `lint-gha` ("Lint GHA", actionlint with shellcheck) and `scan-gha` ("Scan GHA", zizmor), each
  running the consuming repository's `lint:gha` or `scan:gha` mise task with GitHub annotation output.
- A contract check that fails with a README link when `mise.toml` or the job's task is missing.
- mise 2026.9.17 installed through `jdx/mise-action` 5.0.0, with the binary checksum pinned.
- zizmor runs offline (`scan:gha` uses `--offline`), so no token is needed.
- Job summaries with the result, the suppression count, and the local command.
