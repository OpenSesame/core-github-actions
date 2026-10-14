# Run Semgrep Action

## 🧭 Summary

Runs a Semgrep scan and outputs scan results and summaries for downstream steps. For diff scans, pull request events use the PR's base branch (`origin/$GITHUB_BASE_REF`) as the baseline, and every other event uses `INPUT_BASELINE`. The action makes no GitHub API calls.

## Scope/Limitations

- Supports pull request, push and dispatch events. PR context comes only from the event, so a push to a branch with an open PR is scanned against `INPUT_BASELINE`.
- Semgrep diffs against the merge-base of the baseline and `HEAD`, not the baseline's tip, so changes merged into the base branch after the branch was created are not reported. The checkout needs full history (`fetch-depth: 0`) and the baseline ref.
- Runs on the GitHub Actions Node.js 24 runtime.
- Requires Semgrep to be installed and available in the runner environment.
- Expects environment variables for configuration (see below).

## 🔒 Permissions

The following GHA permissions are required to use this step:

```yaml
permissions:
  contents: read
```

## Dependencies

- `semgrep` — must be installed in the runner environment.
- `reviewdog` — for annotation output (optional, for downstream steps).

## ⚙️ Inputs

This action is environment-driven. The following environment variables are required:

| Name                | Required | Description                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------- |
| `INPUT_BASELINE`    | ✅       | Baseline ref for diff scans outside pull request events (e.g., origin/main)            |
| `GITHUB_EVENT_NAME` | ✅       | GitHub provided environment variable for event name (e.g., push, pull_request)         |
| `GITHUB_BASE_REF`   | ❌       | GitHub provided environment variable for the base ref of a PR; used as the PR baseline |
| `SCAN_MODE`         | ✅       | 'diff' or 'full' scan mode                                                             |
| `SEMGREP_CONFIG`    | ✅       | Semgrep ruleset(s) to use                                                              |
| `SEMGREP_TARGETS`   | ✅       | Targets to scan (default: current directory)                                           |
| `FAIL_LEVEL`        | ✅       | Severity level to fail on (e.g., ERROR, WARNING)                                       |
| `EXTRA_ARGS`        | ❌       | Additional arguments to pass to Semgrep                                                |

## 📤 Outputs

Along with writing files for reviewdog annotations and inputs, this action provides the following outputs:

| Name                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| `normalized-baseline` | The resolved baseline ref                           |
| `scan-summary`        | Summary of findings in markdown format              |
| `config-summary`      | Summary of scan config in markdown format           |
| `scan-status`         | 'success' or 'failure' based on findings/fail level |
| `total-findings`      | Total number of findings                            |
| `error-count`         | Number of ERROR severity findings                   |
| `warning-count`       | Number of WARNING severity findings                 |
| `info-count`          | Number of INFO severity findings                    |

## 🚀 Usage

Basic usage example:

```yaml
- name: Run Semgrep
  id: semgrep
  uses: OpenSesame/core-github-actions/.github/actions/run-semgrep@<released-sha> # actions/run-semgrep/2.0.0
  env:
    INPUT_BASELINE: origin/${{ github.event.repository.default_branch }}
    SEMGREP_CONFIG: 'p/default'
    SEMGREP_TARGETS: '.'
    SCAN_MODE: 'full'
    FAIL_LEVEL: 'error'
    EXTRA_ARGS: ''
```

Example outputs:

```yaml
steps.semgrep.outputs.scan-status
steps.semgrep.outputs.total-findings
```

Example usage of outputs in later steps:

```yaml
if: steps.semgrep.outputs.scan-status == 'failure'
  run: echo "Semgrep scan failed at or above threshold."
```

## 🧠 Notes

- This action writes a file for reviewdog annotations (`reviewdog_input.txt`).
- Unit tests for the script are included in `run-semgrep.unit.test.js` (not used by the action, but kept for maintainability).

## Versioning

This action uses namespaced tags for versioning and is tracked in the CHANGELOG.

```text
actions/run-semgrep/vX.Y.Z
```

See the repository's versioning documentation for details on how tags are validated and created.
