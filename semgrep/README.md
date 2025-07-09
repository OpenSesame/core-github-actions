# Semgrep CE Scan Action

This action runs Semgrep security scanning with configurable options and reporting capabilities.

## Features

- **Configurable scan modes**: diff, full, or baseline scanning
- **Multiple severity levels**: error, warning, info
- **Reviewdog integration**: Inline PR comments for findings
- **PR summary comments**: Automated PR comments with scan results
- **Flexible configuration**: Support for custom Semgrep rulesets

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `branch_name` | The name of the branch where lint is running | No | - |
| `semgrep_config` | Rulesets to run with Semgrep | No | `p/default` |
| `fail_severity` | Severity level that causes the action to fail | No | `error` |
| `filter_mode` | Scan mode (diff, full, baseline) | No | `diff` |
| `reporter` | How to report results (github-pr-review for inline, github-pr-check for summary) | No | `github-pr-review` |
| `github_token` | GitHub token for API access and reviewdog | Yes | - |

## Outputs

| Output | Description |
|--------|-------------|
| `total_findings` | Total number of findings from the scan |
| `error_count` | Number of error-level findings |
| `warning_count` | Number of warning-level findings |
| `info_count` | Number of info-level findings |
| `scan_status` | Overall scan status (success, warning, error) |

## Usage Examples

### Basic Usage

```yaml
- name: Run Semgrep Security Scan
  uses: ./semgrep
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Custom Configuration

```yaml
- name: Run Semgrep with Custom Rules
  uses: ./semgrep
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    semgrep_config: "p/security-audit p/owasp-top-10"
    fail_severity: "warning"
    filter_mode: "full"
    reporter: "github-pr-check"
```

### Using with Outputs

```yaml
- name: Run Semgrep Security Scan
  id: security_scan
  uses: ./semgrep
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Check scan results
  run: |
    echo "Total findings: ${{ steps.security_scan.outputs.total_findings }}"
    echo "Errors: ${{ steps.security_scan.outputs.error_count }}"
    echo "Warnings: ${{ steps.security_scan.outputs.warning_count }}"
    echo "Status: ${{ steps.security_scan.outputs.scan_status }}"
```

## Scan Modes

### Diff Mode (Default)
- Scans only changed files in PRs
- Compares against the base branch
- Fastest option for PR workflows

### Full Mode
- Scans entire codebase
- Comprehensive security review
- Best for main branch or release workflows

### Baseline Mode
- Scans against a baseline commit (usually main)
- Good for tracking security debt
- Shows new issues since baseline

## Severity Levels

- **error**: High-severity security issues that should block deployment
- **warning**: Medium-severity issues that should be reviewed
- **info**: Low-severity issues or informational findings

## Reviewdog Reporters

- **github-pr-review**: Inline comments on specific lines in PR
- **github-pr-check**: Summary in PR checks without inline comments

## Permissions Required

The action requires the following permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Full Workflow Example

```yaml
name: Security Scan

on:
  pull_request:
    branches: [main, develop]

permissions:
  contents: read
  pull-requests: write

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Semgrep Security Scan
        uses: ./semgrep
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          semgrep_config: "p/security-audit p/owasp-top-10"
          fail_severity: "error"
          filter_mode: "diff"
          reporter: "github-pr-review"
```

## Notes

- The action automatically installs Semgrep version 1.124.0
- Git history is required for diff mode scanning
- The action will fail if error-level findings are detected (configurable)
- PR comments are automatically updated on subsequent runs 
