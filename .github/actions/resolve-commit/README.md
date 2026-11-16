# Resolve Commit

## Summary

Resolves a commit identifier to the full SHA of the commit it names. It replaces the resolve step
copied into deploy workflows, so a run deploys one commit in every environment and can pass it to
`gh release create --target`, which accepts only a branch or a full SHA.

- Accepts a full SHA, short SHA, tag or branch. An empty `commit-identifier` resolves `github.sha`,
  so a caller can pass its optional `workflow_dispatch` input straight through.
- Outputs the full 40-character SHA as `sha`.
- Fails with an `Unresolved commit` error, and the API's reason, when the identifier names no commit
  in the repository.

## Inputs

| Name                | Required | Default             | Description                                           |
| ------------------- | -------- | ------------------- | ----------------------------------------------------- |
| `commit-identifier` | No       | `''` (`github.sha`) | SHA, short SHA, tag or branch to resolve.             |
| `repository`        | No       | `github.repository` | Repository to resolve the commit in, as `owner/name`. |
| `github-token`      | No       | `github.token`      | Token that can read the repository's contents.        |

## Outputs

| Name  | Description                                   |
| ----- | --------------------------------------------- |
| `sha` | Full 40-character SHA of the resolved commit. |

## Usage

```yaml
resolve-commit:
  name: Resolve Commit
  runs-on: ubuntu-26.04
  permissions:
    contents: read # Required to resolve the commit identifier to its full SHA.
  outputs:
    sha: ${{ steps.resolve.outputs.sha }}
  steps:
    - name: Resolve the commit to its full SHA
      id: resolve
      uses: OpenSesame/core-github-actions/.github/actions/resolve-commit@<sha> # actions/resolve-commit/1.0.0
      with:
        commit-identifier: ${{ inputs.commit-identifier }}
```

Later jobs use `needs.resolve-commit.outputs.sha` for every environment and the release. The step can
also run inside an existing job, such as a build or deploy job, that already has `contents: read`.

Replace `<sha>` with the full commit SHA of the tag: `git rev-list -n1 actions/resolve-commit/1.0.0`.

The action needs no checkout. It uses `gh` and `jq`, which are preinstalled on GitHub-hosted Ubuntu
runners, and the token needs `contents: read` on `repository`.

## Why an action and not a reusable workflow

The resolve runs as its own job in some workflows and as a step inside a build or deploy job in
others. A reusable workflow could only replace the first, and would add a job to the second.

## Versioning

This action follows the repository's component versioning policy. The initial release uses the PR
label `v:a/resolve-commit/1.0.0` and the namespaced tag `actions/resolve-commit/1.0.0`.
