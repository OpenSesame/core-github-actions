# Terraform Plan Environment Roots Workflow Changelog

All notable changes to the **tf_plan_env_roots** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release, replacing `tf_validate_plan_env_roots`, which is deprecated with no direct upgrade
  path. Inputs and secrets match `tf_validate_plan_env_roots` 1.0.0.
- Plans `terraform/dev`, `terraform/stage` and `terraform/prod` in parallel through
  `tf_plan_single_root` 1.0.0 from the same commit, without state locking. With a caller job named
  `Terraform`, checks read `Terraform / <environment> / Plan`.
- Validate runs in Repo Checks (`run_terraform_checks`) instead, and `terraform init` uses each
  root's committed `.terraform.lock.hcl` rather than `-upgrade`.
