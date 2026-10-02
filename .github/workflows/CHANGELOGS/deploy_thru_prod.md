# Deploy Through Production Workflow Changelog

All notable changes to the **deploy_thru_prod** reusable workflow are documented in this file.

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
