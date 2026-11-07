# Terraform Plan Environment Roots

Plans `terraform/dev`, `terraform/stage`, and `terraform/prod` in parallel, without state locking,
through [`tf_plan_single_root`](tf_plan_single_root.md). It never applies, but
providers and data sources may contact live systems. Validate runs in Repo Checks
([`run_terraform_checks`](run_terraform_checks.md)) instead.

## Prerequisites

- Commit `.terraform.lock.hcl` in each of `terraform/dev`, `terraform/stage`, and `terraform/prod`
  with the provider versions approved for the plan. Without it, `terraform init` selects versions
  from the configured constraints and creates a transient lock file on the runner, so the plan is
  not reproducible.

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

| Input                      | Required | Default          | Description                                             |
| -------------------------- | -------- | ---------------- | ------------------------------------------------------- |
| `commit-identifier`        | Yes      |                  | Commit SHA, tag, or branch to plan                      |
| `oidc-domain`              | Yes      |                  | AWS role domain, such as `core` or `reveng`             |
| `terraform-version`        | Yes      |                  | Terraform CLI version                                   |
| `terraform-workspace`      | No       | Environment name | Workspace for every environment                         |
| `build-artifact-directory` | No       |                  | Newline-separated directories to create under each root |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
