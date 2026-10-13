# Deploy a Commit to One Environment

This reusable workflow applies one Terraform root to a selected environment by calling the
`tf_apply` reusable workflow. `terraform apply` validates and plans as part of the apply, so the
workflow has no separate plan job. Callers should validate and plan in CI before merge, for example
with `tf_validate_plan_single_root`.

> **Warning:** This workflow mutates live infrastructure. The apply phase runs Terraform with
> automatic approval. Confirm the target ref, environment, Terraform root, workspace, and GitHub
> environment protections before invoking it.

## Prerequisites

- The caller repository contains the requested Terraform root at `terraform-root`.
- The requested GitHub environment exists and permits deployment.
- The OIDC domain and environment resolve to an AWS role.
- The caller can provide the required organization SSH key and package token.

## Usage

```yaml
jobs:
  deploy-dev:
    uses: OpenSesame/core-github-actions/.github/workflows/deploy_environment.yml@workflows/deploy_environment/0.3.0
    with:
      environment: dev
      commit-identifier: ${{ github.sha }}
      release-tag: 2026.10.02-16-00
      oidc-domain: core
      terraform-workspace: dev
      terraform-root: terraform/dev
      terraform-version: 1.14.0
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

## Inputs

| Input                 | Type   | Required | Default   | Description                                                      |
| --------------------- | ------ | -------- | --------- | ---------------------------------------------------------------- |
| `environment`         | string | Yes      | —         | GitHub environment and AWS account environment to target.        |
| `commit-identifier`   | string | Yes      | —         | Commit SHA, tag, or branch to apply.                             |
| `release-tag`         | string | No       | `unnamed` | Release name passed to the apply workflow and Terraform.         |
| `oidc-domain`         | string | Yes      | —         | Domain used to resolve the AWS role, such as `core` or `reveng`. |
| `terraform-workspace` | string | Yes      | —         | Terraform workspace to select or create.                         |
| `terraform-root`      | string | Yes      | —         | Terraform working directory relative to the repository root.     |
| `terraform-version`   | string | Yes      | —         | Terraform CLI version used for apply.                            |

## Secrets

| Secret                                | Required | Description                                                                                          |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY`               | Yes      | SSH key forwarded to the apply workflow for AWS role resolution and private GitHub access.           |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | Yes      | Package token forwarded to the apply workflow.                                                       |

## Behavior

1. Calls `tf_apply` with the target ref, environment, workspace, root, Terraform version, and
   release tag.

Runs for the same repository and environment share a concurrency group. The workflow declares
`id-token: write` and `contents: read` permissions for its called workflows.
The composed apply job runs on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [Single-root Terraform plan workflow](tf_validate_plan_single_root.md) for CI plans before merge
- [Terraform apply workflow](tf_apply.md)
