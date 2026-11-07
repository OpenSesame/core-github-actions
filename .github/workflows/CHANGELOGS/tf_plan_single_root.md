# Terraform Plan a Single Root Workflow Changelog

All notable changes to the **tf_plan_single_root** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release, replacing `tf_validate_plan_single_root`, which is deprecated with no direct upgrade
  path. Inputs, secrets and the `plan-artifact-name` output match `tf_validate_plan_single_root`
  1.0.0.
- One job, `plan` ("Plan"), so the check reads `<caller job name> / Plan`. It runs `terraform init`,
  selects the workspace, and runs `terraform plan`, writing the plan to the job summary.
- Unlocked plans' concurrency group includes the Terraform workspace as well as the run and root, so
  plans of the same root into different workspaces in one run don't queue or cancel each other.
- The SSH key is written under `umask 077`, so it's never readable by other users, even briefly.
- No `terraform validate` step: validate runs in Repo Checks (`run_terraform_checks`
  `validate:terraform`) before plan, without a backend or credentials.
- `terraform init` runs without `-upgrade`, so it installs the provider versions recorded in each
  root's committed `.terraform.lock.hcl`. A lock file that no longer satisfies the version
  constraints fails init: run `terraform init -upgrade` locally and commit the lock file. A committed
  lock file is required for reproducible plans; without one, init selects provider versions from the
  configured constraints and creates a transient lock file on the runner.
- Before upgrading, make each root's lock file match the provider versions earlier runs applied. Those
  runs used `-upgrade`, so state can record newer providers than the lock file, and Terraform
  refuses to use an older provider than the one that last wrote a resource ("Resource instance
  managed by newer provider version"). Run `terraform init -upgrade` in each root and commit the
  updated `.terraform.lock.hcl` first. The same applies when you deploy an older commit whose lock
  file predates a later apply.
