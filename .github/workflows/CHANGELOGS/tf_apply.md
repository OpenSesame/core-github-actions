# Terraform Apply Workflow Changelog

All notable changes to the **tf_apply** reusable workflow are documented in this file.

## 0.3.1

### Changed

- SSH to github.com is set up by `configure-github-ssh` 1.0.0 instead of an inline step that ran
  `ssh-keyscan`. It pins GitHub's published host keys and keeps the key in `RUNNER_TEMP`, which the
  runner empties after the job. It fails if `~/.ssh/config` already exists with other content.

## 0.3.0

### Changed

- **Breaking:** `terraform init` no longer passes `-upgrade`, so the apply
  installs the provider versions recorded in each root's committed `.terraform.lock.hcl` instead
  of the newest versions the constraints allow. A lock file that no longer satisfies the version
  constraints now fails init: run `terraform init -upgrade` locally and commit the lock file.
  A committed lock file is now required for reproducible applies; without one, init selects
  provider versions from the configured constraints and creates a transient lock file on the runner.
- Before upgrading, refresh each root's lock file. Earlier runs used `-upgrade`, so state can record
  newer providers than the committed lock file, and Terraform refuses to run an older provider than
  the one that last wrote a resource ("Resource instance managed by newer provider version"). Run
  `terraform init -upgrade` in each root. It selects the newest providers the constraints allow and
  can also update modules, so review the lock-file diff against the versions the last apply used,
  raise the constraints if they no longer allow those versions, and commit `.terraform.lock.hcl`.
- To roll back after a later apply, don't plan or deploy the older commit again: its constraints and
  lock file can select providers older than state. Make a new commit from the older code with
  constraints and a lock file compatible with current state, plan it, and deploy that commit.

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
