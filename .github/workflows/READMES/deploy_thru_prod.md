# Deploy Through Production

This reusable workflow deploys one commit sequentially to dev, stage, and prod, creates a timestamped
GitHub release, and posts the final stage, prod, and release status to the associated pull request.

> **Warning:** This workflow mutates live infrastructure in three AWS environments and creates a
> GitHub release. Each environment deployment runs Terraform with automatic approval. Verify the
> target ref, Terraform roots, workspaces, GitHub environment protections, and production readiness
> before invoking it.

## Prerequisites

- The caller repository contains Terraform roots for dev, stage, and prod.
- The `dev`, `stage`, and `prod` GitHub environments exist and permit deployment.
- The OIDC domain resolves AWS roles for all three environments.
- The caller provides the required organization SSH key and package token.

## Usage

```yaml
jobs:
  deploy-through-prod:
    uses: OpenSesame/core-github-actions/.github/workflows/deploy_thru_prod.yml@workflows/deploy_thru_prod/0.1.0
    with:
      commit-identifier: ${{ github.sha }}
      oidc-domain: core
      terraform-version: 1.14.0
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

## Inputs

| Input                  | Type   | Required | Default           | Description                                                                                             |
| ---------------------- | ------ | -------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `commit-identifier`    | string | Yes      | —                 | Commit SHA, tag, or branch to deploy and release.                                                       |
| `oidc-domain`          | string | Yes      | —                 | Domain used to resolve AWS roles, such as `core` or `reveng`.                                           |
| `terraform-workspace`  | string | No       | Environment name  | Workspace used for every deployment when supplied; otherwise each deployment uses its environment name. |
| `terraform-root-dev`   | string | No       | `terraform/dev`   | Terraform root for the dev deployment.                                                                  |
| `terraform-root-stage` | string | No       | `terraform/stage` | Terraform root for the stage deployment.                                                                |
| `terraform-root-prod`  | string | No       | `terraform/prod`  | Terraform root for the prod deployment.                                                                 |
| `terraform-version`    | string | Yes      | —                 | Terraform CLI version used for all environments.                                                        |

## Secrets

| Secret                                | Required | Description                                                                                         |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY`               | Yes      | SSH key forwarded to each environment deployment for AWS role resolution and private GitHub access. |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | Yes      | Package token forwarded to each environment deployment.                                             |

## Behavior

1. Generates a UTC runner timestamp in `YYYY.MM.DD-HH-MM` form for the release tag.
2. Deploys dev by calling `deploy_environment`.
3. Deploys stage only after dev succeeds.
4. Deploys prod only after stage succeeds.
5. Creates a GitHub release for `commit-identifier` only after prod succeeds.
6. Posts stage, prod, and release results to the pull request when a PR context is available.

The release-tag job only runs when the caller's event is a merged pull request or
`workflow_dispatch`. Other caller event contexts cause the deployment chain to be skipped. Runs for
the same repository share one concurrency group.

The workflow requests `id-token: write`, `contents: write`, and `pull-requests: write` permissions.
Its direct and composed jobs run on Ubuntu 24.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [Single-environment deploy workflow](deploy_environment.md)
