# Run Markdown Checks

Lints Markdown with the repo's `lint:markdown` script. It doesn't look for Markdown files itself, so call it only when the repository has them.

## Usage

```yaml
jobs:
  markdown:
    name: Markdown
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_markdown_checks.yml@<released-sha> # workflows/run_markdown_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

The check is reported as `Markdown / Checks`.

## Contract

The job sets up Node from `.nvmrc`, runs `npm ci --ignore-scripts` (the tools are npm
devDependencies), then runs each script with `npm run`:

| Script          | Step | Typical command     |
| --------------- | ---- | ------------------- |
| `lint:markdown` | Lint | `markdownlint-cli2` |

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
| `baselined` | Number of inline `markdownlint-disable` comments in `*.md` files         |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
