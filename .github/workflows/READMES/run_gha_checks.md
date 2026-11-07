# Run GHA Checks

Lints GitHub Actions workflows and composite actions with the repo's `lint:gha` mise task and scans
them with `scan:gha`. It doesn't look for GitHub Actions files itself, so call it only when the repository has them.

## Usage

```yaml
jobs:
  gha:
    name: GHA
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_gha_checks.yml@<released-sha> # workflows/run_gha_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

`ci-context` is the caller's [`resolve_ci_context`](resolve_ci_context.md) job, which picks the commit
to check and skips pushes that an open pull request already covers.

The check is reported as `GHA / Checks`.

## Contract

The job sets up mise 2026.9.17, which installs the tools pinned in the repo's `mise.toml`, then runs
each mise task with `mise run`. It doesn't need Node, `package.json` or `npm ci`:

| mise task  | Step | Typical command            |
| ---------- | ---- | -------------------------- |
| `lint:gha` | Lint | actionlint                 |
| `scan:gha` | Scan | `zizmor --offline .github` |

- Every task step runs even when an earlier one failed, as long as mise set up.
- A missing task fails its own step, and mise logs that the task doesn't exist.
- Keep a matching `package.json` script for each task, such as `"lint:gha": "mise run lint:gha"`, so
  `npm run check` still runs them locally. CI doesn't use those scripts.
- The job fails if any step failed.

## Inputs

| Input               | Default               | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to check |

## Outputs

| Output      | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| `lint`      | Outcome of the lint step: `success`, `failure`, `cancelled` or `skipped` |
| `scan`      | Outcome of the scan step: `success`, `failure`, `cancelled` or `skipped` |
| `baselined` | Number of inline `# zizmor: ignore[...]` comments under `.github`        |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
