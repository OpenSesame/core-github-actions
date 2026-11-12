# Deploy Through Production Workflow Changelog

All notable changes to the **deploy_thru_prod** reusable workflow are documented in this file.

## 0.5.0

### Changed

- Each environment deployment calls `tf_apply` 0.4.0 directly instead of the deprecated
  `deploy_environment`, which only passed inputs through. Check names lose one level: for example,
  `Apply Dev / Terraform Apply / Terraform Apply` becomes `Apply Dev / Terraform Apply`.
- The concurrency group covers the repository, the three Terraform roots, and the workspace, and is
  prefixed with `core-gha-deploy-thru-prod-` so it can't match a caller's own group. Chains for
  different roots or workspaces in one repository no longer wait on or replace each other.

## 0.4.2

### Changed

- The workflow sets `permissions: {}`, and each job requests only what it uses: `id-token: write`
  and `contents: read` for the deploy jobs, `contents: write` for the release job, and
  `pull-requests: write` for the status comment. Callers grant the same permissions as before.
- Composes `deploy_environment` 0.4.2.

## 0.4.1

### Changed

- Composes `deploy_environment` 0.4.1, whose `tf_apply` sets up SSH with `configure-github-ssh` 1.0.0
  instead of running `ssh-keyscan`.

## 0.4.0

### Changed

- **Breaking:** composes `deploy_environment` 0.4.0, whose `terraform init` no longer passes
  `-upgrade` and so installs the provider versions in each root's required, committed
  `.terraform.lock.hcl`.

## 0.3.1

### Fixed

- Composes `deploy_environment` 0.3.1.
- The release-tag step quotes `$GITHUB_OUTPUT`.

### Changed

- The release is created with `gh release create` instead of `ncipollo/release-action`, with the
  same tag, target commit, and title, and an empty body. The release job no longer checks out the
  repository.

## 0.3.0

### Changed

- Each environment deployment uses `deploy_environment` 0.3.0, which applies without a separate
  plan job. Runs finish sooner, and `Apply <Env> / Terraform Validate and Plan / …` checks are no
  longer reported.

## 0.2.0

### Changed

- Updated the workflow's jobs and composed environment-deployment chain from Ubuntu 24.04 to
  Ubuntu 26.04.

## 0.1.0

### Changed

- Pinned the workflow's jobs and composed environment-deployment chain to Ubuntu 24.04 for a
  stable, versioned runner contract.

## 0.0.1

### Added

- Established the first versioned baseline of the existing reusable workflow.
- Documented the current inputs, secrets, permissions, event gating, sequential environment
  deployments, GitHub release creation, PR status reporting, and live-infrastructure mutation
  warning.

This release records existing behavior and does not change the workflow implementation.
