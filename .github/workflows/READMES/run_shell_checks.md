# Run Shell Checks

Lints and format-checks shell scripts with the repo's `lint:shell` and `format:shell` scripts. It doesn't look for Shell files itself, so call it only when the repository has them.

## Usage

```yaml
jobs:
  shell:
    name: Shell
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_shell_checks.yml@<released-sha> # workflows/run_shell_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

`ci-context` is the caller's [`resolve_ci_context`](resolve_ci_context.md) job, which picks the commit
to check and skips pushes that an open pull request already covers.

The check is reported as `Shell / Checks`.

## Contract

The job sets up Node from `.nvmrc` and mise 2026.9.17 for the tools pinned in the repo's
`mise.toml`, runs `npm ci --ignore-scripts`, then runs each script with `npm run`:

| Script         | Step             | Typical command                                  |
| -------------- | ---------------- | ------------------------------------------------ |
| `lint:shell`   | Lint             | `mise run lint:shell` (shellcheck)               |
| `format:shell` | Check formatting | `mise run format:shell` (for example `shfmt -d`) |

- Every script step runs even when an earlier one failed, as long as `npm ci` succeeded.
- A missing script fails its own step; npm logs `Missing script: "<name>"`.
- The job fails if any step failed.

## Inputs

| Input               | Default               | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to check |

## Outputs

| Output      | Value                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| `lint`      | Outcome of the lint step: `success`, `failure`, `cancelled` or `skipped`         |
| `format`    | Outcome of the format-check step: `success`, `failure`, `cancelled` or `skipped` |
| `baselined` | Number of inline `# shellcheck disable=` directives                              |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
