# Terraform Apply

This reusable workflow checks out a requested ref and applies one Terraform root to a selected
GitHub environment and Terraform workspace.

> **Warning:** This workflow mutates live infrastructure. It runs `terraform apply -auto-approve`
> with temporary AWS credentials and does not prompt for confirmation. Review the target ref,
> environment, Terraform root, workspace, and any applicable environment protections before use.

## Prerequisites

- The caller repository contains the requested Terraform root at `terraform-root`.
- The requested GitHub environment exists and permits the deployment job to run.
- The OIDC domain and environment resolve to an AWS role through `gha-oidc-access`.
- The requested Terraform version is available through `hashicorp/setup-terraform`.

## Usage

```yaml
jobs:
  terraform-apply:
    uses: OpenSesame/core-github-actions/.github/workflows/tf_apply.yml@workflows/tf_apply/0.1.0
    with:
      environment: dev
      oidc-domain: core
      commit-identifier: ${{ github.sha }}
      release-tag: 2026.10.02-16-00
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
| `oidc-domain`         | string | Yes      | —         | Domain used to resolve the AWS role, such as `core` or `reveng`. |
| `commit-identifier`   | string | Yes      | —         | Commit SHA, tag, or branch to check out and apply.               |
| `release-tag`         | string | No       | `unnamed` | Release name exposed to Terraform as `TF_VAR_release_name`.      |
| `terraform-workspace` | string | Yes      | —         | Terraform workspace to select or create.                         |
| `terraform-root`      | string | Yes      | —         | Terraform working directory relative to the repository root.     |
| `terraform-version`   | string | Yes      | —         | Terraform CLI version to install.                                |

## Secrets

| Secret                                | Required | Description                                                                 |
| ------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY`               | Yes      | SSH key used by the AWS role resolver and for private GitHub module access. |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | Yes      | Package token required by the declared workflow contract.                   |

## Behavior

1. Writes the invocation context and inputs to the GitHub Actions job summary.
2. Resolves an AWS role and configures temporary credentials for `environment`.
3. Checks out `commit-identifier` and configures SSH access for private GitHub dependencies.
4. Installs the requested Terraform version.
5. Runs `terraform init -upgrade`.
6. Selects or creates `terraform-workspace`.
7. Runs `terraform apply -auto-approve -input=false`.

The apply job sets `TF_VAR_IACDeploymentRef` to the current Actions run URL and
`TF_VAR_release_name` to `release-tag`. Runs for the same repository and environment share a
concurrency group. The workflow requests `id-token: write` and `contents: read` permissions.
Both workflow jobs run on Ubuntu 24.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [Terraform apply documentation](https://developer.hashicorp.com/terraform/cli/commands/apply)
