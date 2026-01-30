# Run Semgrep Action

## 🧭 Summary

Runs a Semgrep scan normalizing the baseline for diff scans depending on push vs PR context. Outputs scan results and summaries for downstream steps.

## Scope/Limitations

- Supports both push and pull request events.
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
- `https` — standard Node.js module for API requests included in default action runners
- `reviewdog` — for annotation output (optional, for downstream steps).

## ⚙️ Inputs

This action is environment-driven. The following environment variables are required:

| Name                | Required | Description                                                                                 |
| ------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `HAS_PR`            | ✅       | Whether the current context has an associated PR (true/false)                               |
| `PR_NUMBER`         | ❌       | PR number if applicable                                                                     |
| `PR_URL`            | ❌       | PR URL if applicable                                                                        |
| `INPUT_BASELINE`    | ✅       | Baseline ref to use for diffing (e.g., origin/main)                                         |
| `GITHUB_EVENT_NAME` | ✅       | GitHub provided environment variable for event name (e.g., push, pull_request)              |
| `GITHUB_REF_NAME`   | ✅       | GitHub provided environment variable for the branch or tag name that triggered the workflow |
| `GITHUB_BASE_REF`   | ❌       | GitHub provided environment variable for the base ref of a PR (if applicable)               |
| `GITHUB_REPOSITORY` | ✅       | GitHub provided environment variable for the repository (e.g., owner/repo)                  |
| `GITHUB_TOKEN`      | ✅       | GitHub token for API access                                                                 |
| `SCAN_MODE`         | ✅       | 'diff' or 'full' scan mode                                                                  |
| `SEMGREP_CONFIG`    | ✅       | Semgrep ruleset(s) to use                                                                   |
| `SEMGREP_TARGETS`   | ✅       | Targets to scan (default: current directory)                                                |
| `FAIL_LEVEL`        | ✅       | Severity level to fail on (e.g., ERROR, WARNING)                                            |
| `EXTRA_ARGS`        | ❌       | Additional arguments to pass to Semgrep                                                     |

## 📤 Outputs

Along with writing files for reviewdog annotations and inputs, this action provides the following outputs:

| Name                 | Description                                         |
| -------------------- | --------------------------------------------------- |
| `normalizedBaseline` | The resolved baseline ref                           |
| `scanSummary`        | Summary of findings in markdown format              |
| `configSummary`      | Summary of scan config in markdown format           |
| `scanStatus`         | 'success' or 'failure' based on findings/fail level |
| `totalFindings`      | Total number of findings                            |
| `numErrors`          | Number of ERROR severity findings                   |
| `numWarnings`        | Number of WARNING severity findings                 |
| `numInfo`            | Number of INFO severity findings                    |

## 🚀 Usage

Basic usage example:

```yaml
- name: Run Semgrep
  id: semgrep
  uses: OpenSesame/core-github-actions/.github/actions/run-semgrep@actions/run-semgrep/1.0.0
  env:
    HAS_PR: ${{ env.HAS_PR }}
    INPUT_BASELINE: ${{ env.INPUT_BASELINE }}
    GITHUB_EVENT_NAME: ${{ github.event_name }}
    GITHUB_REF_NAME: ${{ github.ref_name }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITHUB_REPOSITORY: ${{ github.repository }}
    SEMGREP_CONFIG: 'p/default'
    SEMGREP_TARGETS: '.'
    SCAN_MODE: 'full'
    FAIL_LEVEL: 'error'
    EXTRA_ARGS: ''
```

Example outputs:

```yaml
steps.semgrep.outputs.scanStatus
steps.semgrep.outputs.totalFindings
```

Example usage of outputs in later steps:

```yaml
if: steps.semgrep.outputs.scanStatus == 'failure'
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
