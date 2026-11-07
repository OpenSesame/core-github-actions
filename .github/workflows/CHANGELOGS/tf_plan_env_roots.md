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
  root's required, committed `.terraform.lock.hcl` rather than `-upgrade`. Without a lock file, init
  selects provider versions from the configured constraints and creates a transient lock file on the
  runner, so the plan is not reproducible.
- Before upgrading, make each root's lock file match the provider versions earlier runs applied. Those
  runs used `-upgrade`, so state can record newer providers than the lock file, and Terraform
  refuses to use an older provider than the one that last wrote a resource ("Resource instance
  managed by newer provider version"). Run `terraform init -upgrade` in each root and commit the
  updated `.terraform.lock.hcl` first. The same applies when you deploy an older commit whose lock
  file predates a later apply.
