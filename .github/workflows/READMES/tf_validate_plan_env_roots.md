# Terraform Validate and Plan Environment Roots

This reusable workflow validates and plans the conventional `terraform/dev`, `terraform/stage`, and
`terraform/prod` roots in parallel. Each matrix job delegates to the single-root Terraform plan
workflow.

> **Safety:** The workflow authenticates to the dev, stage, and prod AWS environments and runs
> Terraform initialization and planning against each one. It does not apply infrastructure changes,
> but providers and data sources may contact live systems.

## Prerequisites

- The caller repository contains `terraform/dev`, `terraform/stage`, and `terraform/prod` roots.
- The `dev`, `stage`, and `prod` GitHub environments exist and permit the plan jobs to run.
- The OIDC domain resolves roles for all three environments.

## Usage

```yaml
jobs:
  terraform-plans:
    uses: OpenSesame/core-github-actions/.github/workflows/tf_validate_plan_env_roots.yml@workflows/tf_validate_plan_env_roots/0.1.0
    with:
      commit-identifier: ${{ github.sha }}
      oidc-domain: core
      terraform-version: 1.14.0
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

## Inputs

| Input                      | Type   | Required | Default          | Description                                                                                         |
| -------------------------- | ------ | -------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `commit-identifier`        | string | Yes      | —                | Commit SHA, tag, or branch to check out and plan.                                                   |
| `oidc-domain`              | string | Yes      | —                | Domain used to resolve AWS roles, such as `core` or `reveng`.                                       |
| `terraform-workspace`      | string | No       | Environment name | Workspace used for every environment when supplied; otherwise each job uses its matrix environment. |
| `terraform-version`        | string | Yes      | —                | Terraform CLI version used for all plan jobs.                                                       |
| `build-artifact-directory` | string | No       | —                | Newline-separated directories forwarded to each single-root plan job for creation before planning.  |

## Secrets

| Secret                                | Required | Description                                                          |
| ------------------------------------- | -------- | -------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY`               | Yes      | SSH key forwarded for AWS role resolution and private GitHub access. |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | Yes      | Package token forwarded to each plan job.                            |

## Behavior

- Runs dev, stage, and prod plan jobs through a matrix with fail-fast disabled.
- Uses `terraform/<environment>` as each Terraform root.
- Disables Terraform state locking for all three plan jobs.
- Uses the supplied `terraform-workspace` for every environment when present; otherwise uses the
  environment name.
- Does not request plan artifacts from the called workflow.
- Runs the composed plan jobs on Ubuntu 24.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [Single-root Terraform plan workflow](tf_validate_plan_single_root.md)
