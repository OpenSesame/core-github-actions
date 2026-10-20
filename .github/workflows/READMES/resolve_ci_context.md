# Resolve CI Context

Decides which commit CI runs against and whether to run CI, so a CI workflow can trigger on both
`push` and `pull_request` without running twice. A push to a branch with an open PR is skipped (the PR
run covers it); every other run executes CI.

## Usage

```yaml
on:
  push:
  pull_request:
  workflow_dispatch:
    inputs:
      commit-identifier:
        type: string
        required: false

permissions: {}

jobs:
  ci-context:
    name: CI Context
    uses: OpenSesame/core-github-actions/.github/workflows/resolve_ci_context.yml@<released-sha> # workflows/resolve_ci_context/1.0.0
    permissions:
      contents: read # Required to read commit metadata for the open-PR lookup.
      pull-requests: read # Required to find an open PR from the pushed branch.
    with:
      commit-identifier: ${{ inputs.commit-identifier }}

  app-ci:
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    # check out ${{ needs.ci-context.outputs.commit-identifier }}
```

Pass `commit-identifier` explicitly; a reusable workflow can't see the caller's dispatch inputs. The
check is reported as `CI Context / Resolve`.

## Outputs

| Output              | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| `commit-identifier` | The input if set, else the PR head SHA on `pull_request`, else `github.sha` |
| `should-run-ci`     | `'false'` only for a push to a non-default branch with an open PR           |
| `pr-exists`         | `'true'` when the run's branch has an open PR                               |
| `pr-number`         | That PR's number, or empty                                                  |
| `pr-url`            | That PR's URL, or empty                                                     |

PR outputs come from the event on `pull_request` runs, and from
[`pr-open-check`](../../actions/pr-open-check/README.md) (same-repo PRs from this branch only) on other
branch runs. If the lookup fails, the job warns and CI runs.

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
