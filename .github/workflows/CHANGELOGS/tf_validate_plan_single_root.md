# Terraform Validate and Plan a Single Root Workflow Changelog

All notable changes to the **tf_validate_plan_single_root** reusable workflow are documented in
this file.

## 0.2.1

### Fixed

- Lock-free plans (`with-lock: false`) no longer share the per-repository, per-environment
  concurrency group. GitHub keeps only one waiting run per group, so a burst of lock-free CI plans
  could cancel another waiting plan, including a deployment's. Each lock-free run now gets its own
  group. Locked plans still share the per-repository, per-environment group.

## 0.2.0

### Changed

- Updated the workflow job from Ubuntu 24.04 to Ubuntu 26.04.

## 0.1.0

### Changed

- Pinned the workflow job to Ubuntu 24.04 for a stable, versioned runner contract.
- Bumped `OpenSesame/gha-oidc-access/get-role-arn` from the `v2` commit to `v2.0.2`.
- Bumped `aws-actions/configure-aws-credentials` from `v6.2.4` to `v6.3.0`.

## 0.0.1

### Added

- Established the first versioned baseline of the existing reusable workflow.
- Documented the current inputs, secrets, output, permissions, plan artifact behavior, and
  live-system considerations.

This release records existing behavior and does not change the workflow implementation.
