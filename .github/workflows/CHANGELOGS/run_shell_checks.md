# Run Shell Checks Workflow Changelog

All notable changes to the **run_shell_checks** reusable workflow are documented in this file.

## 1.0.3

### Fixed

- The `baselined` output counts only real inline directives (`# shellcheck disable=` outside
  Markdown files), and counts each one rather than each line. Names in documentation, changelogs and
  test fixtures inflated the count.

## 1.0.2

### Changed

- Bumped the mise version that `jdx/mise-action` installs from 2026.9.17 to 2026.10.25, with its
  published SHA-256 checksum. mise now rewrites `mise.lock` in `generate` mode during installs and
  refuses archives whose symlinks point outside the install directory.

## 1.0.1

### Changed

- Bumped `jdx/mise-action` from 5.0.0 to 5.2.5, pinned by commit SHA. The mise version it installs
  (2026.9.17) is unchanged.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input.
- One job, `checks` ("Checks"), that runs the `lint:shell`, `format:shell` mise tasks with `mise run`,
  without Node or `npm ci`. Each step runs after earlier failures once mise set up. A missing task
  fails its own step.
- Outputs `lint`, `format` and `baselined` (inline `# shellcheck disable=` directives).
