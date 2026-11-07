# Terraform Plan Environment Roots Workflow Changelog

All notable changes to the **tf_plan_env_roots** reusable workflow are documented in this file.

## 1.0.1

### Changed

- Composes `tf_plan_single_root` 1.0.1 from the same commit, which bumps `actions/upload-artifact`
  to 7.0.2.
- Its `tf_plan_single_root` 1.0.1 sets up SSH with `configure-github-ssh` 1.0.0, which pins GitHub's host
  keys, instead of running `ssh-keyscan`.

## 1.0.0

### Added

- First release, replacing `tf_validate_plan_env_roots`, which is deprecated with no direct upgrade
  path. Inputs and secrets match `tf_validate_plan_env_roots` 1.0.0.
- Plans `terraform/dev`, `terraform/stage` and `terraform/prod` in parallel through
  `tf_plan_single_root` 1.0.0 from the same commit, without state locking. With a caller job named
  `Terraform`, checks read `Terraform / <environment> / Plan`.
- Validate runs in Repo Checks (`run_terraform_checks`) instead, and `terraform init` runs with
  `-lockfile=readonly` rather than `-upgrade`: it uses each root's committed `.terraform.lock.hcl`
  and fails when one is missing or doesn't satisfy the version constraints.
- Before upgrading, refresh each root's lock file. Earlier runs used `-upgrade`, so state can record
  newer providers than the committed lock file, and Terraform refuses to run an older provider than
  the one that last wrote a resource ("Resource instance managed by newer provider version"). Run
  `terraform init -upgrade` in each root. It selects the newest providers the constraints allow and
  can also update modules, so review the lock-file diff against the versions the last apply used,
  raise the constraints if they no longer allow those versions, and commit `.terraform.lock.hcl`.
- To roll back after a later apply, don't plan or deploy the older commit again: its constraints and
  lock file can select providers older than state. Make a new commit from the older code with
  constraints and a lock file compatible with current state, plan it, and deploy that commit.
