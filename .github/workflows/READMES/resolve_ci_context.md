# Resolve CI Context

This reusable workflow decides which commit CI runs against and whether a run should execute CI at
all, so a repository's CI workflow can trigger on both `push` and `pull_request` without running CI
twice for the same change. It replaces the inline `resolve-ci-context` job.

A push to a branch that has an open PR is skipped, because the PR run covers it with PR context.
Pull request runs, manual dispatches, and pushes to the default branch always run CI, as do pushes to
a branch with no open PR.

## Usage

```yaml
on:
  push:
  pull_request:
  workflow_dispatch:
    inputs:
      commit-identifier:
        description: Commit SHA or ref to run CI against; defaults to the selected branch head
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
    name: App CI
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    runs-on: ubuntu-26.04
    permissions:
      contents: read # Required to check out the code under test.
    steps:
      - name: Check out code
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.ci-context.outputs.commit-identifier }}
          persist-credentials: false
```

Pass `commit-identifier` explicitly. `inputs` in a reusable workflow refers to the reusable workflow's
own inputs, so the caller's dispatch input is not visible to it otherwise. On `push` and
`pull_request` runs the caller's `inputs.commit-identifier` is empty, which is the intended value.

The check is reported as `CI Context / Resolve`.

## Inputs

| Input               | Type   | Required | Default | Description                                                                     |
| ------------------- | ------ | -------- | ------- | ------------------------------------------------------------------------------- |
| `commit-identifier` | string | No       | `''`    | Commit SHA or ref from the caller's `workflow_dispatch` input; empty otherwise. |

## Outputs

| Output              | Description                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `commit-identifier` | The `commit-identifier` input if set, else the PR head SHA on `pull_request` runs, else `github.sha`.                    |
| `should-run-ci`     | `'true'` on `pull_request`, `workflow_dispatch`, and default-branch runs, and on pushes with no open PR; else `'false'`. |
| `pr-exists`         | `'true'` when the run has an open PR from its branch; otherwise `'false'`.                                               |
| `pr-number`         | Number of that PR; empty when there is none.                                                                             |
| `pr-url`            | URL of that PR; empty when there is none.                                                                                |

## How the PR is found

- **`pull_request` runs:** the PR comes from the event payload. No API call is made.
- **Pushes and dispatches on other branches:** the workflow calls
  [`pr-open-check`](../../actions/pr-open-check/README.md) 2.1.0 with `head-ref: github.ref_name`, so
  only an open PR opened from that branch of this repository counts. A PR from another branch that
  shares the commit, or from a fork, does not.
- **Default-branch runs and tag refs:** no lookup; the PR outputs are empty and `pr-exists` is
  `'false'`.

The lookup fails open. If it errors, the job emits a warning, `pr-exists` is `'false'`, and the push
runs CI. When a push is skipped, the job summary links the open PR whose run covers it.

## Permissions

| Permission      | Reason                                               |
| --------------- | ---------------------------------------------------- |
| `contents`      | `read`: read commit metadata for the open-PR lookup. |
| `pull-requests` | `read`: find an open PR from the pushed branch.      |

The workflow job runs on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).
