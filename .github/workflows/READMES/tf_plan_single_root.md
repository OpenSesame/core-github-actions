# Terraform Plan a Single Root

Runs `terraform init` and `plan` for one root in a GitHub environment and writes the plan to the job
summary. Validate runs in Repo Checks ([`run_terraform_checks`](run_terraform_checks.md)) instead,
and init uses the root's required, committed `.terraform.lock.hcl`. It never applies, but providers
and data sources may contact live systems.

## Prerequisites

- Commit `.terraform.lock.hcl` in the Terraform root with the provider versions approved for the
  plan. Without it, `terraform init` selects versions from the configured constraints and creates a
  transient lock file on the runner, so the plan is not reproducible.

## Usage

```yaml
jobs:
  terraform:
    name: Terraform
    uses: OpenSesame/core-github-actions/.github/workflows/tf_plan_single_root.yml@<released-sha> # workflows/tf_plan_single_root/1.0.0
    permissions:
      id-token: write # Required to assume the plan role.
      contents: read # Required to check out the Terraform code.
    with:
      environment: dev
      oidc-domain: core
      commit-identifier: ${{ github.sha }}
      terraform-workspace: dev
      terraform-root: terraform/dev
      terraform-version: 1.14.0
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

The check is reported as `<caller job name> / Plan`.

## Inputs

| Input                      | Required | Default | Description                                                          |
| -------------------------- | -------- | ------- | -------------------------------------------------------------------- |
| `environment`              | Yes      |         | GitHub environment and AWS account environment                       |
| `oidc-domain`              | Yes      |         | AWS role domain, such as `core` or `reveng`                          |
| `commit-identifier`        | Yes      |         | Commit SHA, tag, or branch to plan                                   |
| `terraform-workspace`      | Yes      |         | Workspace to select or create                                        |
| `terraform-root`           | Yes      |         | Terraform directory relative to the repo root                        |
| `terraform-version`        | Yes      |         | Terraform CLI version                                                |
| `with-lock`                | No       | `true`  | Lock state while planning; locked plans for an env run one at a time |
| `write-artifact`           | No       | `false` | Upload the rendered plan as `terraform-plan-<environment>`           |
| `build-artifact-directory` | No       |         | Newline-separated directories to create under the root               |

Output: `plan-artifact-name` (empty unless `write-artifact` is `true`). Terraform gets no GitHub token.

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
