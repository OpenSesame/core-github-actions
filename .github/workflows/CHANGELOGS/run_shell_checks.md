# Run Shell Checks Workflow Changelog

All notable changes to the **run_shell_checks** reusable workflow are documented in this file.

## 1.0.1

### Changed

- Bumped `jdx/mise-action` from 5.0.0 to 5.2.5, pinned by commit SHA. The mise version it installs
  (2026.9.17) is unchanged.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input.
- One job, `checks` ("Checks"), that runs the `lint:shell`, `format:shell` mise tasks with `mise run`,
  without Node or `npm ci`. Each step runs after earlier failures once mise set up. A missing task fails its own step.
- Outputs `lint`, `format` and `baselined` (inline `# shellcheck disable=` directives).
