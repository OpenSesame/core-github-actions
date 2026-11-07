# Terraform Plan a Single Root Workflow Changelog

All notable changes to the **tf_plan_single_root** reusable workflow are documented in this file.

## 1.0.1

### Changed

- Bumped `actions/upload-artifact` from 7.0.1 to 7.0.2, pinned by commit SHA.

## 1.0.0

### Added

- First release, replacing `tf_validate_plan_single_root`, which is deprecated with no direct upgrade
  path. Inputs, secrets and the `plan-artifact-name` output match `tf_validate_plan_single_root`
  1.0.0.
- One job, `plan` ("Plan"), so the check reads `<caller job name> / Plan`. It runs `terraform init`,
  selects the workspace, and runs `terraform plan`, writing the plan to the job summary.
- Unlocked plans' concurrency group includes the Terraform workspace as well as the run and root, so
  plans of the same root into different workspaces in one run don't queue or cancel each other.
- The SSH key is written under `umask 077`, so it's never readable by other users, even briefly, and
  `ssh-keyscan` runs with a 30-second timeout so a stalled connection can't hang the job.
- No `terraform validate` step: validate runs in Repo Checks (`run_terraform_checks`
  `validate:terraform`) before plan, without a backend or credentials.
- `terraform init` runs with `-lockfile=readonly` instead of `-upgrade`. It installs the provider
  versions in the root's committed `.terraform.lock.hcl`, and fails when the lock file is missing or
  doesn't satisfy the version constraints, so a plan never picks its own provider versions.
- Before upgrading, refresh each root's lock file. Earlier runs used `-upgrade`, so state can record
  newer providers than the committed lock file, and Terraform refuses to run an older provider than
  the one that last wrote a resource ("Resource instance managed by newer provider version"). Run
  `terraform init -upgrade` in each root. It selects the newest providers the constraints allow and
  can also update modules, so review the lock-file diff against the versions the last apply used,
  raise the constraints if they no longer allow those versions, and commit `.terraform.lock.hcl`.
- To roll back after a later apply, don't plan or deploy the older commit again: its constraints and
  lock file can select providers older than state. Make a new commit from the older code with
  constraints and a lock file compatible with current state, plan it, and deploy that commit.
