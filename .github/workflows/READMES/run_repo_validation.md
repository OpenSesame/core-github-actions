# Run Repo Validation

Runs the repository validator kit committed at `.core-services/generated/validate-repo.mjs` against
the repository standard. [`run_repo_checks`](run_repo_checks.md) calls it as its `Standard` job,
and most repositories should call that instead.

## Usage

```yaml
jobs:
  standard:
    name: Standard
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_repo_validation.yml@<released-sha> # workflows/run_repo_validation/1.0.1
    permissions:
      contents: read # Required to check out the repository to validate.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
```

`ci-context` is the caller's [`resolve_ci_context`](resolve_ci_context.md) job, which picks the commit
to check and skips pushes that an open pull request already covers.

The check is reported as `Standard / Validate`.

## Contract

- Node comes from the repo's `.nvmrc`.
- With `ORG_READ_ONLY_SSH_KEY`, the job looks up the newest `repository-validator/x.y.z` tag in
  OpenSesame/core-services-ai-tooling and passes it as `--latest-version`, so the validator can warn
  when the kit is out of date. The lookup runs with `BatchMode=yes` and a 30-second timeout. If it
  fails, the job warns and validates without `--latest-version`.
- Without the secret, the job writes a notice and validates without `--latest-version`.
- A missing validator kit fails the job with a `Repo Validation` error.

## Inputs

| Input               | Default               | Description                            |
| ------------------- | --------------------- | -------------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to validate |

## Secrets

| Secret                  | Required | Description                                                         |
| ----------------------- | -------- | ------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY` | No       | Read-only SSH key that can read OpenSesame/core-services-ai-tooling |

## Outputs

| Output   | Value                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| `result` | Outcome of the validation step: `success`, `failure`, `cancelled` or `skipped` |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
