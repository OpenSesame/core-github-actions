# Run Semgrep Action

Runs Semgrep and exposes finding counts and markdown summaries; writes `reviewdog_input.txt` for
reviewdog. Used by the [`run_semgrep_scan`](../../workflows/READMES/run_semgrep_scan.md) workflow.

Diff scans use `origin/$GITHUB_BASE_REF` on `pull_request` events and `INPUT_BASELINE` otherwise;
Semgrep compares against the merge-base with `HEAD`. Diff scans need `fetch-depth: 0`. Semgrep must
already be installed.

## Usage

```yaml
- name: Run Semgrep
  id: semgrep
  uses: OpenSesame/core-github-actions/.github/actions/run-semgrep@<released-sha> # actions/run-semgrep/2.0.0
  env:
    INPUT_BASELINE: origin/${{ github.event.repository.default_branch }}
    SCAN_MODE: diff # or full
    SEMGREP_CONFIG: p/default
    SEMGREP_TARGETS: .
    FAIL_LEVEL: error
    EXTRA_ARGS: ''
```

## Environment

| Name              | Required | Description                                        |
| ----------------- | -------- | -------------------------------------------------- |
| `INPUT_BASELINE`  | Yes      | Baseline ref for diff scans outside `pull_request` |
| `SCAN_MODE`       | Yes      | `diff` or `full`                                   |
| `SEMGREP_CONFIG`  | Yes      | Rulesets, space- or comma-separated                |
| `SEMGREP_TARGETS` | Yes      | Files or directories to scan                       |
| `FAIL_LEVEL`      | Yes      | `error`, `warning`, or `info`                      |
| `EXTRA_ARGS`      | No       | Extra Semgrep arguments                            |

## Outputs

`scan-status` (`success`/`failure`), `total-findings`, `error-count`, `warning-count`, `info-count`,
`scan-summary`, `config-summary`, `normalized-baseline`.

## Contribution

Update the action, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
