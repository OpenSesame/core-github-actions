# Terraform Plan a Single Root

Runs `terraform init` and `plan` for one root in a GitHub environment and writes the plan to the job
summary. Validate runs in Repo Checks ([`run_terraform_checks`](run_terraform_checks.md)) instead,
and init uses the root's required, committed `.terraform.lock.hcl`. It never applies, but providers
and data sources may contact live systems.

## Pairing plan and apply

Pair this workflow with an apply that also uses the committed lock file: `tf_apply` 0.3.0, or
`deploy_environment` and `deploy_thru_prod` 0.4.0 or later. Earlier versions run
`terraform init -upgrade`, so they can apply newer providers than this plan showed.

## Prerequisites

- Commit `.terraform.lock.hcl` in the Terraform root with the provider versions approved for the
  plan. `terraform init` runs with `-lockfile=readonly`, so the plan fails when the lock file is
  missing or doesn't satisfy the version constraints.

## Usage

```yaml
jobs:
  terraform:
    name: Terraform
    uses: OpenSesame/core-github-actions/.github/workflows/tf_plan_single_root.yml@<released-sha> # workflows/tf_plan_single_root/1.1.0
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

## Build artifact directories

Terraform that packages build output, like a Lambda `source_path` or an `archive_file`
`source_dir`, fails to plan when CI hasn't built it. After `terraform init`, the workflow reads the
root and every local module in `.terraform/modules/modules.json`, and creates each directory that a
string starting with `${path.module}`, `${path.root}`, or `${path.cwd}` points to, when the
directory:

- is missing and inside the repository
- is ignored by git, so it's build output and not a mistyped path
- doesn't look like a file (a last segment such as `index.js`)
- comes from a string with no other interpolation, such as `${var.name}`

It skips remote modules, commented lines, `output_path` lines, which Terraform writes, and lines
that call `fileexists()`, which fails on a directory. It annotates what it doesn't create. List any
other directories in `build-artifact-directory`, or set `detect-build-artifact-directories` to
`false` to turn detection off.

Each created directory, and each empty directory from `build-artifact-directory`, gets an empty
`.terraform-plan-placeholder` file, because `archive_file` refuses to zip an empty directory. The
plan shows changed package hashes for that code, since it doesn't contain the real build output.

## Inputs

| Input                               | Required | Default | Description                                                                                                           |
| ----------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `environment`                       | Yes      |         | GitHub environment and AWS account environment                                                                        |
| `oidc-domain`                       | Yes      |         | AWS role domain, such as `core` or `reveng`                                                                           |
| `commit-identifier`                 | Yes      |         | Commit SHA, tag, or branch to plan                                                                                    |
| `terraform-workspace`               | Yes      |         | Workspace to select or create                                                                                         |
| `terraform-root`                    | Yes      |         | Terraform directory relative to the repo root                                                                         |
| `terraform-version`                 | Yes      |         | Terraform CLI version                                                                                                 |
| `with-lock`                         | No       | `true`  | Lock state while planning; locked plans for an env run one at a time                                                  |
| `write-artifact`                    | No       | `false` | Upload the rendered plan as `terraform-plan-<environment>`                                                            |
| `build-artifact-directory`          | No       |         | Newline-separated directories to create before planning, as paths relative to `terraform-root`; `..` may leave it     |
| `detect-build-artifact-directories` | No       | `true`  | Create the missing build artifact directories that the Terraform references; see [above](#build-artifact-directories) |

Output: `plan-artifact-name` (empty unless `write-artifact` is `true`). Terraform gets no GitHub token.

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
