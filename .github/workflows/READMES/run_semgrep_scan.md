# Run Semgrep Scan

This workflow runs [Semgrep](https://semgrep.dev/) on your repository to perform static code analysis, to report security issues, bugs, and code quality problems.

## Purpose

The `run_semgrep_scan` workflow designed to be reusable and configurable for different scan scenarios. It supports both full and differential scans, integrates with pushes and PRs, and can be customized for different rule sets, targets, and failure thresholds. The workflow is intended to:

- Enforce code security and quality standards
- Catch issues early in the development lifecycle
- Provide actionable feedback directly in GitHub

## Usage

This workflow is intended to be called by other workflows using `workflow_call`.

### Inputs

You can customize the scan by providing the following inputs:

| Input Name              | Type    | Default           | Description                                                       |
|-------------------------|---------|-------------------|-------------------------------------------------------------------|
| `commit_identifier`     | string  | (required)        | Commit SHA or ref to scan                                         |
| `cancel_in_progress`    | boolean | true              | Cancel in-progress run for the same ref                           |
| `semgrep_config`        | string  | p/default         | Semgrep rulesets to use (YAML array, newline, or space-separated) |
| `semgrep_targets`       | string  | .                 | Files/directories to scan                                         |
| `extra_args`            | string  | ''                | Additional arguments to pass to Semgrep                           |
| `semgrep_version`       | string  | ''                | Semgrep version to install                                        |
| `fail_severity`         | string  | error             | Minimum severity to fail the workflow (`error`, `warning`, `info`)|
| `semgrep_scan_mode`     | string  | full              | Scan mode: `full`, `diff`, or `baseline`                          |
| `baseline_ref`          | string  | origin/main       | Ref for diff/baseline scans                                       |
| `reviewdog_filter_mode` | string  | nofilter          | Reviewdog display filter: `added`, `diff_context`, `nofilter`     |
| `reviewdog_reporter`    | string  | github-pr-review  | Reviewdog reporter type                                           |

See the workflow file for full input documentation and defaults.

### How it works

1. Checks out the code at the specified commit or ref.
2. Checks for an open PR and normalizes settings if one is found.
3. Installs dependencies and Semgrep (customizable version).
4. Runs Semgrep with the provided configuration and scan mode.
5. Summarizes findings and posts results to the Actions UI, Job Summary, and if applicable, PR comments and Reviewdog review.
6. Fails the workflow if findings meet or exceed the configured severity threshold.

## Outputs

The workflow provides the following outputs for use in downstream jobs or for reporting:

- `total_findings`: Total number of findings
- `error_count`: Number of ERROR findings
- `warning_count`: Number of WARNING findings
- `info_count`: Number of INFO findings
- `scan_status`: `success` or `failure` based on findings and fail threshold
- `scan_md_summary`: Markdown summary of findings
- `config_md_summary`: Markdown summary of the config settings used
- `normalized_baseline`: The resolved baseline ref used for diff/baseline scans

Findings are also posted as PR comments and Reviewdog annotations (if enabled), and a summary is written to the GitHub Actions job summary.

## Contribution

- Update the workflow file and related javascript file
- Update the README and CHANGELOG
- Create a PR and set a version label following [versioning instructions](../../../VERSIONING.md)

## References

- [Semgrep Documentation](https://semgrep.dev/docs/)
