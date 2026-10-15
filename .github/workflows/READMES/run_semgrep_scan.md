# Run Semgrep Scan

This workflow runs [Semgrep](https://semgrep.dev/) on your repository to perform static code analysis,
to report security issues, bugs, and code quality problems.

## Purpose

The `run_semgrep_scan` workflow is reusable and configurable for different scan scenarios. It supports
full and diff scans, and can be customized for different rule sets, targets, and failure thresholds.
The workflow is intended to:

- Enforce code security and quality standards
- Catch issues early in the development lifecycle
- Provide actionable feedback directly in GitHub

## Usage

This workflow is intended to be called by other workflows using `workflow_call`. The standard caller
runs a full scan on the default branch and a diff scan everywhere else:

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

The check is reported as `Semgrep / Scan`. The workflow needs no secrets; it uses the caller's
`GITHUB_TOKEN` with the permissions the caller job grants.

### Inputs

| Input                   | Type   | Default                   | Description                                                                            |
| ----------------------- | ------ | ------------------------- | -------------------------------------------------------------------------------------- |
| `commit-identifier`     | string | Triggering ref or SHA     | Commit SHA or ref to scan                                                              |
| `semgrep-config`        | string | `p/default`               | Semgrep rulesets to use (YAML array, newline, or space-separated)                      |
| `semgrep-targets`       | string | `.`                       | Files/directories to scan                                                              |
| `extra-args`            | string | `''`                      | Additional arguments to pass to Semgrep                                                |
| `semgrep-version`       | string | `1.178.0`                 | Semgrep version to install                                                             |
| `fail-severity`         | string | `error`                   | Minimum severity to fail the workflow (`error`, `warning`, `info`)                     |
| `semgrep-scan-mode`     | string | `full`                    | Scan mode: `full` or `diff`                                                            |
| `baseline-ref`          | string | `origin/<default branch>` | Baseline for diff scans outside `pull_request` events                                  |
| `reviewdog-filter-mode` | string | `added`                   | Findings reviewdog posts on `pull_request` events: `added`, `diff_context`, `nofilter` |
| `reviewdog-reporter`    | string | `github-pr-review`        | Reviewdog reporter on `pull_request` events: `github-pr-review`, `github-pr-check`     |

### Pull request context

PR context comes only from the event:

- **`pull_request` events:** diff scans use `origin/<base branch>` as the baseline. Reviewdog uses
  `reviewdog-reporter` and `reviewdog-filter-mode`, and the workflow upserts a summary comment on the
  PR.
- **Every other event:** diff scans use `baseline-ref`. Reviewdog reports with `github-check` and
  `nofilter`, and no PR comment is posted, even when the pushed branch has an open PR. Pair the
  workflow with [`resolve_ci_context`](resolve_ci_context.md) so pushes covered by a PR run are
  skipped.

Semgrep's `--baseline-commit` scans the baseline at `git merge-base <baseline> HEAD`, so changes merged
into the base branch after the branch was created are not reported as new findings. Diff scans check
out full history so the baseline ref and merge-base are available.

### How it works

1. Checks out the code at the specified commit or ref.
2. Installs Semgrep (customizable version).
3. Runs Semgrep with the provided configuration and scan mode.
4. Summarizes findings in the job summary and, if there are findings, reports them with reviewdog.
5. On pull requests, upserts a summary comment.
6. Fails the workflow if findings meet or exceed the configured severity threshold.

## Outputs

| Output           | Description                |
| ---------------- | -------------------------- |
| `total-findings` | Total number of findings   |
| `error-count`    | Number of ERROR findings   |
| `warning-count`  | Number of WARNING findings |
| `info-count`     | Number of INFO findings    |

The workflow job runs on Ubuntu 26.04.

## Contribution

- Update the workflow file and the [`run-semgrep`](../../actions/run-semgrep/README.md) action
- Update the README and CHANGELOG
- Create a PR and set a version label following [versioning instructions](../../../VERSIONING.md)

## References

- [Semgrep Documentation](https://semgrep.dev/docs/)
