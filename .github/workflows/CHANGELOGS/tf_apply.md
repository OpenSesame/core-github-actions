# Terraform Apply Workflow Changelog

All notable changes to the **tf_apply** reusable workflow are documented in this file.

## 0.2.1

### Fixed

- Workflow expressions in `run` scripts (the context summary, the SSH key and the workspace name) are
  passed through environment variables instead of being interpolated into the script, closing a
  template-injection path. Summary output and behavior are unchanged.
- The summary step quotes `$GITHUB_STEP_SUMMARY` and writes through one grouped redirect.

### Changed

- The checkout no longer persists the job's `GITHUB_TOKEN` in the git config. Terraform modules are
  fetched with the SSH key, which is unchanged.

## 0.2.0

### Changed

- Updated workflow jobs from Ubuntu 24.04 to Ubuntu 26.04.

## 0.1.0

### Changed

- Pinned workflow jobs to Ubuntu 24.04 for a stable, versioned runner contract.
- Bumped `OpenSesame/gha-oidc-access/get-role-arn` from the `v2` commit to `v2.0.2`.
- Bumped `aws-actions/configure-aws-credentials` from `v6.2.4` to `v6.3.0`.

## 0.0.1

### Added

- Established the first versioned baseline of the existing reusable workflow.
- Documented the current inputs, secrets, permissions, Terraform execution sequence, and
  live-infrastructure mutation warning.

This release records existing behavior and does not change the workflow implementation.
