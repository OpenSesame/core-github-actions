# Deploy a Commit to One Environment Workflow Changelog

All notable changes to the **deploy_environment** reusable workflow are documented in this file.

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
