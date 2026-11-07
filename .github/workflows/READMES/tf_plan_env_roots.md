# Terraform Plan Environment Roots

Plans `terraform/dev`, `terraform/stage`, and `terraform/prod` in parallel, without state locking,
through [`tf_plan_single_root`](tf_plan_single_root.md). It never applies, but
providers and data sources may contact live systems. Validate runs in Repo Checks
([`run_terraform_checks`](run_terraform_checks.md)) instead.

## Pairing plan and apply

Pair this workflow with an apply that also uses the committed lock file: `tf_apply` 0.3.0, or
`deploy_environment` and `deploy_thru_prod` 0.4.0 or later. Earlier versions run
`terraform init -upgrade`, so they can apply newer providers than this plan showed.

## Prerequisites

- Commit `.terraform.lock.hcl` in each of `terraform/dev`, `terraform/stage`, and `terraform/prod`
  with the provider versions approved for the plan. `terraform init` runs with `-lockfile=readonly`,
  so each plan fails when its lock file is missing or doesn't satisfy the version constraints.

## Usage

```yaml
jobs:
  terraform:
    name: Terraform
    uses: OpenSesame/core-github-actions/.github/workflows/tf_plan_env_roots.yml@<released-sha> # workflows/tf_plan_env_roots/1.0.0
    permissions:
      id-token: write # Required to assume the plan roles.
      contents: read # Required to check out the Terraform code.
    with:
      commit-identifier: ${{ github.sha }}
      oidc-domain: core
      terraform-version: 1.14.0
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

Checks are reported as `Terraform / dev / Plan`, `Terraform / stage / Plan`, and
`Terraform / prod / Plan`.

## Inputs

| Input                      | Required | Default          | Description                                                                                                                          |
| -------------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `commit-identifier`        | Yes      |                  | Commit SHA, tag, or branch to plan                                                                                                   |
| `oidc-domain`              | Yes      |                  | AWS role domain, such as `core` or `reveng`                                                                                          |
| `terraform-version`        | Yes      |                  | Terraform CLI version                                                                                                                |
| `terraform-workspace`      | No       | Environment name | Workspace for every environment                                                                                                      |
| `build-artifact-directory` | No       |                  | Newline-separated directories to create before planning, as paths relative to each `terraform/<environment>` root; `..` may leave it |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
