# Deploy Through Production

This reusable workflow deploys one commit sequentially to dev, stage, and prod, creates a timestamped
GitHub release, and posts the final stage, prod, and release status to the associated pull request.

> **Warning:** This workflow mutates live infrastructure in three AWS environments and creates a
> GitHub release. Each environment deployment runs Terraform with automatic approval. Verify the
> target ref, Terraform roots, workspaces, GitHub environment protections, and production readiness
> before invoking it.

## Pairing plan and apply

This version composes `deploy_environment` 0.4.1 and `tf_apply` 0.3.1, whose `terraform init`
installs the provider versions in each root's committed `.terraform.lock.hcl`. Plan in CI with
[`tf_plan_single_root`](tf_plan_single_root.md) or [`tf_plan_env_roots`](tf_plan_env_roots.md),
which do the same. The deprecated `tf_validate_plan_*` workflows still run
`terraform init -upgrade`, so with them CI can plan with newer providers than this apply uses, and
the apply may not match the reviewed plan. Move plan and apply to the lock-file versions together.

Even when paired, the apply doesn't run the CI plan. `terraform apply` makes a new plan at deploy
time, with `TF_VAR_release_name` and `TF_VAR_IACDeploymentRef` set, which `tf_plan_*` don't set.
State or infrastructure changes since the CI plan, or a root that uses those variables, can make the
apply differ from what CI showed.

## Prerequisites

- The caller repository contains Terraform roots for dev, stage, and prod.
- The `dev`, `stage`, and `prod` GitHub environments exist and permit deployment.
- The OIDC domain resolves AWS roles for all three environments.
- The caller provides the required organization SSH key and package token.
- Each Terraform root has a committed `.terraform.lock.hcl` with the provider versions approved for
  deployment.

## Usage

```yaml
jobs:
  deploy-through-prod:
    uses: OpenSesame/core-github-actions/.github/workflows/deploy_thru_prod.yml@workflows/deploy_thru_prod/0.4.2
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
5. Creates a GitHub release for `commit-identifier` with `gh release create`, only after prod
   succeeds.
6. Posts stage, prod, and release results to the pull request when a PR context is available.

The release-tag job only runs when the caller's event is a merged pull request or
`workflow_dispatch`. Other caller event contexts cause the deployment chain to be skipped. Runs for
the same repository share one concurrency group.

The workflow sets `permissions: {}`, so callers still grant `id-token: write`, `contents: write`,
and `pull-requests: write`, and each job requests only what it uses: the deploy jobs
`id-token: write` and `contents: read`, the release job `contents: write`, and the status job
`pull-requests: write`.
Its direct and composed jobs run on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [Single-environment deploy workflow](deploy_environment.md)
