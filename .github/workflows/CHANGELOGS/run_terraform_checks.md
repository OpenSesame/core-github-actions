# Run Terraform Checks Workflow Changelog

All notable changes to the **run_terraform_checks** reusable workflow are documented in this file.

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
- One job, `checks` ("Checks"), that runs the `init:terraform`, `validate:terraform`, `lint:terraform`,
  `format:terraform` and `scan:terraform` mise tasks with `mise run`,
  without Node or `npm ci`. Each step runs after earlier failures once mise set up, except Validate,
  which needs Initialize to have succeeded. A missing task fails its own step.
- `init:terraform` and `validate:terraform` must work without secrets or cloud credentials:
  `-backend=false`, and module sources that download without credentials.
- Outputs `init`, `validate`, `lint`, `format`, `scan` and `baselined` (findings in tracked `*.checkov.baseline` files, plus inline `#checkov:skip=` and `# tflint-ignore:` comments in `*.tf` files).
