# Run JS Checks

Lints and format-checks JavaScript and TypeScript with the repo's `lint:js` and `format:prettier` scripts. It doesn't look for JavaScript or TypeScript files itself, so call it only when the repository has them. [`run_repo_checks`](run_repo_checks.md) does that, and most repositories should call it instead.

## Usage

```yaml
jobs:
  js:
    name: JS
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_js_checks.yml@<released-sha> # workflows/run_js_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to check.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

`ci-context` is the caller's [`resolve_ci_context`](resolve_ci_context.md) job, which picks the commit
to check and skips pushes that an open pull request already covers.

The check is reported as `JS / Checks`.

## Contract

The job sets up Node from `.nvmrc`, runs `npm ci --ignore-scripts` (the tools are npm
devDependencies), then runs each script with `npm run`:

| Script            | Step             | Typical command    |
| ----------------- | ---------------- | ------------------ |
| `lint:js`         | Lint             | `eslint`           |
| `format:prettier` | Check formatting | `prettier --check` |

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
| `baselined` | Number of inline `eslint-disable` and `prettier-ignore` comments                 |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
