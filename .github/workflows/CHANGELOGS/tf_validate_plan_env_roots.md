# Terraform Validate and Plan Environment Roots Workflow Changelog

All notable changes to the **tf_validate_plan_env_roots** reusable workflow are documented in this
file.

## 0.2.1

### Fixed

- Composes `tf_validate_plan_single_root` 0.2.1, so the dev, stage, and prod plans (all
  lock-free) each get their own concurrency group instead of sharing one with every caller's plans.
  A burst of CI plans no longer cancels another waiting plan.

## 0.2.0

### Changed

- Updated the composed environment plan jobs from Ubuntu 24.04 to Ubuntu 26.04.

## 0.1.0

### Changed

- Pinned the composed environment plan jobs to Ubuntu 24.04 for a stable, versioned runner
  contract.

## 0.0.1

### Added

- Established the first versioned baseline of the existing reusable workflow.
- Documented the current inputs, secrets, environment matrix, workspace selection, and
  live-system planning considerations.

This release records existing behavior and does not change the workflow implementation.
