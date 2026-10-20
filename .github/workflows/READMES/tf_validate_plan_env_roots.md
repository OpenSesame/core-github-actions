# Terraform Validate and Plan Environment Roots

Plans `terraform/dev`, `terraform/stage`, and `terraform/prod` in parallel, without state locking,
through [`tf_validate_plan_single_root`](tf_validate_plan_single_root.md). It never applies, but
providers and data sources may contact live systems.

## Usage

```yaml
jobs:
  terraform:
    name: Terraform
    uses: OpenSesame/core-github-actions/.github/workflows/tf_validate_plan_env_roots.yml@<released-sha> # workflows/tf_validate_plan_env_roots/1.0.0
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

Checks are reported as `Terraform / dev / Validate Plan`, `Terraform / stage / Validate Plan`, and
`Terraform / prod / Validate Plan`.

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
