# Run GHA Checks

Lints GitHub Actions workflows and composite actions with the repo's `lint:gha` script and scans them with `scan:gha`. It's one of the Repo Checks workflows: [`run_repo_checks`](run_repo_checks.md) calls it
when the repository has GitHub Actions files, and most repositories should call that instead.

## Usage

```yaml
jobs:
  gha:
    name: GHA
    uses: OpenSesame/core-github-actions/.github/workflows/run_gha_checks.yml@<released-sha> # workflows/run_gha_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

The check is reported as `GHA / Checks`.

## Contract

The job sets up Node from `.nvmrc` and mise 2026.9.17 for the tools pinned in the repo's
`mise.toml`, runs `npm ci --ignore-scripts`, then runs each script with `npm run`:

| Script     | Step | Typical command                          |
| ---------- | ---- | ---------------------------------------- |
| `lint:gha` | Lint | `mise run lint:gha` (actionlint)         |
| `scan:gha` | Scan | `mise run scan:gha` (zizmor `--offline`) |

- Every script step runs even when an earlier one failed, as long as `npm ci` succeeded.
- A missing script fails its own step; npm logs `Missing script: "<name>"`.
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
