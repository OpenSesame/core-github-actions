# Run Terraform Checks

Lints, format-checks and scans Terraform with the repo's `lint:terraform`, `format:terraform` and `scan:terraform` scripts. It doesn't look for Terraform files itself, so call it only when the repository has them.

## Usage

```yaml
jobs:
  terraform:
    name: Terraform
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_terraform_checks.yml@<released-sha> # workflows/run_terraform_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

`ci-context` is the caller's [`resolve_ci_context`](resolve_ci_context.md) job, which picks the commit
to check and skips pushes that an open pull request already covers.

The check is reported as `Terraform / Checks`.

## Contract

The job sets up Node from `.nvmrc` and mise 2026.9.17 for the tools pinned in the repo's
`mise.toml`, runs `npm ci --ignore-scripts`, then runs each script with `npm run`:

| Script             | Step             | Typical command                                            |
| ------------------ | ---------------- | ---------------------------------------------------------- |
| `lint:terraform`   | Lint             | `mise run lint:terraform` (tflint, plus a lock file check) |
| `format:terraform` | Check formatting | `mise run format:terraform` (`terraform fmt -check`)       |
| `scan:terraform`   | Scan             | `mise run scan:terraform` (Checkov)                        |

- Every script step runs even when an earlier one failed, as long as `npm ci` succeeded.
- A missing script fails its own step; npm logs `Missing script: "<name>"`.
- The job fails if any step failed.

## Inputs

| Input               | Default               | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to check |

## Outputs

| Output      | Value                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `lint`      | Outcome of the lint step: `success`, `failure`, `cancelled` or `skipped`                                                               |
| `format`    | Outcome of the format-check step: `success`, `failure`, `cancelled` or `skipped`                                                       |
| `scan`      | Outcome of the scan step: `success`, `failure`, `cancelled` or `skipped`                                                               |
| `baselined` | Number of findings in tracked `*.checkov.baseline` files, plus inline `#checkov:skip=` and `# tflint-ignore:` comments in `*.tf` files |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
