# Deploy a Commit to One Environment Workflow Changelog

All notable changes to the **deploy_environment** reusable workflow are documented in this file.

## 0.3.1

### Fixed

- Composes `tf_apply` 0.2.1, which passes workflow expressions to its scripts through environment
  variables and no longer persists checkout credentials.

## 0.3.0

### Removed

- Removed the `Terraform Validate and Plan` job that ran before apply. `terraform apply` already
  validates and plans, and the separate lock-free plan was never used by the apply. It added run
  time and shared a concurrency group with callers' CI plans, so a burst of CI plans could cancel a
  waiting deployment. Deployment runs no longer report `<caller> / Terraform Validate and Plan / …`
  checks; validate and plan in CI before merge instead.

## 0.2.0

### Changed

- Updated the composed Terraform plan and apply jobs from Ubuntu 24.04 to Ubuntu 26.04.

## 0.1.0

### Changed

- Pinned the composed Terraform plan and apply jobs to Ubuntu 24.04 for a stable, versioned runner
  contract.

## 0.0.1

### Added

- Established the first versioned baseline of the existing reusable workflow.
- Documented the current inputs, secrets, permissions, plan-before-apply sequence, concurrency, and
  live-infrastructure mutation warning.

This release records existing behavior and does not change the workflow implementation.
