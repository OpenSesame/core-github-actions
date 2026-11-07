# Run Terraform Checks

Initializes, validates, lints, format-checks and scans Terraform with the repo's `init:terraform`,
`validate:terraform`, `lint:terraform`, `format:terraform` and `scan:terraform` mise tasks. It
doesn't look for Terraform files itself, so call it only when the repository has them.
[`run_repo_checks`](run_repo_checks.md) does that, and most repositories should call it instead.

## Usage

```yaml
jobs:
  terraform:
    name: Terraform
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_terraform_checks.yml@<released-sha> # workflows/run_terraform_checks/1.0.1
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

`ci-context` is the caller's [`resolve_ci_context`](resolve_ci_context.md) job, which picks the commit
to check and skips pushes that an open pull request already covers.

The check is reported as `Terraform / Checks`.

## Contract

The job sets up mise 2026.9.17, which installs the tools pinned in the repo's `mise.toml`, then runs
each mise task with `mise run`. It doesn't need Node, `package.json` or `npm ci`:

| mise task            | Step             | Typical command                                                                                                         |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `init:terraform`     | Initialize       | `terraform init -backend=false -lockfile=readonly` in each root, failing when `.terraform.lock.hcl` is missing or stale |
| `validate:terraform` | Validate         | `terraform validate` in each root                                                                                       |
| `lint:terraform`     | Lint             | tflint                                                                                                                  |
| `format:terraform`   | Check formatting | `terraform fmt -check`                                                                                                  |
| `scan:terraform`     | Scan             | Checkov                                                                                                                 |

- Every task step runs even when an earlier one failed, as long as mise set up. Validate
  needs the providers and modules Initialize downloads, so it runs only when Initialize succeeded.
- A missing task fails its own step, and mise logs that the task doesn't exist.
- Each Terraform root must commit `.terraform.lock.hcl`. `init:terraform` must use
  `terraform init -backend=false -lockfile=readonly` so a missing or stale lock file fails in CI.
  This check only protects a deploy that waits for it. `tf_plan_single_root` and `tf_plan_env_roots`
  also init with `-lockfile=readonly`, so a plan can't select its own provider versions. `tf_apply`
  doesn't, so gate deploys on a passing CI run for the same commit.
- Keep a matching `package.json` script for each task, such as `"lint:terraform": "mise run lint:terraform"`, so
  `npm run check` still runs them locally. CI doesn't use those scripts.
- The job has no secrets or cloud credentials, so the `init:terraform` and `validate:terraform` tasks
  must work without them: initialize with `-backend=false`, and use module sources that download
  without credentials, such as public registries or public git. Roots with private git, S3 or other
  authenticated module sources fail here. Plan stays in [`tf_plan_env_roots`](tf_plan_env_roots.md).
- The job fails if any step failed.

## Inputs

| Input               | Default               | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to check |

## Outputs

| Output      | Value                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `init`      | Outcome of the initialize step: `success`, `failure`, `cancelled` or `skipped`                                                         |
| `validate`  | Outcome of the validate step: `success`, `failure`, `cancelled` or `skipped`                                                           |
| `lint`      | Outcome of the lint step: `success`, `failure`, `cancelled` or `skipped`                                                               |
| `format`    | Outcome of the format-check step: `success`, `failure`, `cancelled` or `skipped`                                                       |
| `scan`      | Outcome of the scan step: `success`, `failure`, `cancelled` or `skipped`                                                               |
| `baselined` | Number of findings in tracked `*.checkov.baseline` files, plus inline `#checkov:skip=` and `# tflint-ignore:` comments in `*.tf` files |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
