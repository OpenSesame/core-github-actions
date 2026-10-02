# Terraform Validate and Plan a Single Root

This reusable workflow initializes, validates, and plans one Terraform root against a selected
GitHub environment and Terraform workspace. It writes the rendered plan to the job summary and can
optionally upload the rendered plan as an artifact.

> **Safety:** The workflow authenticates to AWS and runs `terraform init -upgrade`, workspace
> selection, and `terraform plan`. It does not apply the plan, but providers and data sources may
> still contact live systems during initialization and planning.

## Prerequisites

- The caller repository contains the requested Terraform root at `terraform-root`.
- The requested GitHub environment exists and permits the deployment job to run.
- The OIDC domain and environment resolve to an AWS role through `gha-oidc-access`.
- The requested Terraform version is available through `hashicorp/setup-terraform`.

## Usage

```yaml
jobs:
  terraform-plan:
    uses: OpenSesame/core-github-actions/.github/workflows/tf_validate_plan_single_root.yml@workflows/tf_validate_plan_single_root/0.0.1
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

## Inputs

| Input                      | Type    | Required | Default | Description                                                                                      |
| -------------------------- | ------- | -------- | ------- | ------------------------------------------------------------------------------------------------ |
| `environment`              | string  | Yes      | —       | GitHub environment and AWS account environment to target.                                        |
| `oidc-domain`              | string  | Yes      | —       | Domain used to resolve the AWS role, such as `core` or `reveng`.                                 |
| `commit-identifier`        | string  | Yes      | —       | Commit SHA, tag, or branch to check out and plan.                                                |
| `with-lock`                | boolean | No       | `true`  | Whether Terraform should lock state while creating the plan.                                     |
| `write-artifact`           | boolean | No       | `false` | Whether to upload the rendered plan text as an artifact.                                         |
| `terraform-workspace`      | string  | Yes      | —       | Terraform workspace to select or create.                                                         |
| `terraform-root`           | string  | Yes      | —       | Terraform working directory relative to the repository root.                                     |
| `terraform-version`        | string  | Yes      | —       | Terraform CLI version to install.                                                                |
| `build-artifact-directory` | string  | No       | —       | Newline-separated directories to create beneath the Terraform working directory before planning. |

## Secrets

| Secret                                | Required | Description                                                                 |
| ------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY`               | Yes      | SSH key used by the AWS role resolver and for private GitHub module access. |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | Yes      | Package token required by the declared workflow contract.                   |

The current implementation also references `ORG_GITHUB_PACKAGES_READ_WRITE_TOKEN` while running
`terraform plan`, but that secret is not declared by `workflow_call` and is not part of the
`0.0.1` contract. Terraform configurations that depend on that environment variable may fail until
the workflow contract is corrected.

## Outputs

| Output               | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `plan-artifact-name` | Artifact name when `write-artifact` is `true`; otherwise empty. |

When enabled, artifact upload looks for `terraform/<environment>/tfplan.txt`, regardless of the
`terraform-root` value supplied by the caller.

## Behavior

1. Resolves an AWS role, configures temporary credentials, and checks out `commit-identifier`.
2. Configures SSH access for private GitHub dependencies.
3. Installs the requested Terraform version.
4. Creates any requested build-artifact directories.
5. Runs `terraform init -upgrade`, `terraform validate`, and workspace selection.
6. Reinitializes Terraform and creates `tfplan` with the configured lock behavior.
7. Writes a human-readable plan to the GitHub Actions job summary.
8. Optionally uploads the rendered plan text for seven days.

Runs for the same repository and environment share a concurrency group. The job requests
`id-token: write` and `contents: read` permissions.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [Terraform plan documentation](https://developer.hashicorp.com/terraform/cli/commands/plan)
