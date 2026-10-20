# Run Semgrep Scan

Runs [Semgrep](https://semgrep.dev/) and reports findings with reviewdog. On `pull_request` runs it
posts review comments and a summary comment; other runs report as check annotations.

## Usage

```yaml
jobs:
  semgrep:
    name: Semgrep
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_semgrep_scan.yml@<released-sha> # workflows/run_semgrep_scan/2.0.0
    permissions:
      contents: read # Required to check out the code to scan.
      pull-requests: write # Required to post review comments and the summary comment on pull requests.
      checks: write # Required for reviewdog check annotations outside pull requests.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
      semgrep-scan-mode: ${{ github.ref_name == github.event.repository.default_branch && 'full' || 'diff' }}
```

This runs a full scan on the default branch and a diff scan elsewhere. The check is reported as
`Semgrep / Scan`. Pair it with [`resolve_ci_context`](resolve_ci_context.md) so pushes covered by a PR
run are skipped.

## Inputs

| Input                   | Default                   | Description                                                    |
| ----------------------- | ------------------------- | -------------------------------------------------------------- |
| `commit-identifier`     | Triggering ref or SHA     | Commit SHA or ref to scan                                      |
| `semgrep-scan-mode`     | `full`                    | `full` or `diff`                                               |
| `semgrep-config`        | `p/default`               | Rulesets, space- or newline-separated                          |
| `semgrep-targets`       | `.`                       | Files or directories to scan                                   |
| `fail-severity`         | `error`                   | Lowest severity that fails the job: `error`, `warning`, `info` |
| `baseline-ref`          | `origin/<default branch>` | Diff baseline outside `pull_request` (PRs use their base)      |
| `extra-args`            | `''`                      | Extra Semgrep arguments                                        |
| `semgrep-version`       | `1.178.0`                 | Semgrep version to install                                     |
| `reviewdog-filter-mode` | `added`                   | PR comments: `added`, `diff_context`, or `nofilter`            |
| `reviewdog-reporter`    | `github-pr-review`        | PR reporter: `github-pr-review` or `github-pr-check`           |

Outputs: `total-findings`, `error-count`, `warning-count`, `info-count`.

## Contribution

Update the workflow, the [`run-semgrep`](../../actions/run-semgrep/README.md) action if needed, the
README, and the changelog together, and set a version label per [VERSIONING.md](../../../VERSIONING.md).
