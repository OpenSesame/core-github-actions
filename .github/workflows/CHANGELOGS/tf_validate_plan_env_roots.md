# Terraform Validate and Plan Environment Roots Workflow Changelog

All notable changes to the **tf_validate_plan_env_roots** reusable workflow are documented in this
file.

## 1.0.0

### Changed

- **Breaking:** composes `tf_validate_plan_single_root` 1.0.0, and the matrix job is renamed from
  `TF-Validate-Plan-Roots` ("TF Validate/Plan ENV Roots (<environment>, false)") to `environment`,
  named after its environment. With a caller job named `Terraform`, checks read
  `Terraform / <environment> / Validate Plan`. Required status checks that use the old names must be
  updated.
- **Breaking:** workflow-level permissions are `{}` and the job requests `id-token: write` and
  `contents: read`, so the caller job must grant both.

### Removed

- The `with-lock` matrix dimension, which was `false` for every environment. Plans stay lock-free.

## 0.2.1

### Fixed

- Composes `tf_validate_plan_single_root` 0.2.1, so the lock-free dev, stage, and prod plans no
  longer share a concurrency group with plans from other workflow runs. A burst of CI runs no longer
  cancels another run's waiting plan. Calls within one run that use the same environment and
  Terraform root still share a group.

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
