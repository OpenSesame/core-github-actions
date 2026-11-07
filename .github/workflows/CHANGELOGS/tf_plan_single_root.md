# Terraform Plan a Single Root Workflow Changelog

All notable changes to the **tf_plan_single_root** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release, replacing `tf_validate_plan_single_root`, which is deprecated with no direct upgrade
  path. Inputs, secrets and the `plan-artifact-name` output match `tf_validate_plan_single_root`
  1.0.0.
- One job, `plan` ("Plan"), so the check reads `<caller job name> / Plan`. It runs `terraform init`,
  selects the workspace, and runs `terraform plan`, writing the plan to the job summary.
- No `terraform validate` step: validate runs in Repo Checks (`run_terraform_checks`
  `validate:terraform`) before plan, without a backend or credentials.
- `terraform init` runs without `-upgrade`, so it installs the provider versions recorded in each
  root's committed `.terraform.lock.hcl`. A lock file that no longer satisfies the version
  constraints fails init: run `terraform init -upgrade` locally and commit the lock file. Roots
  without a lock file are unaffected.
