# Check CI Result

## Summary

Checks the results of the jobs a CI result job needs. It replaces the `ci-result` script copied into each standard `on_push_ci.yml`.

- Writes a table of each needed job and its result to the step summary.
- Passes when every result is `success` or `skipped`.
- Fails when any result is `failure` or `cancelled`, with one `::error` line that lists those jobs.
- Fails with an `Invalid needs-json` error when `needs-json` is empty, is not valid JSON, has no jobs, or has an entry without a valid job ID and result.

## Inputs

| Name         | Required | Description                                    |
| ------------ | -------- | ---------------------------------------------- |
| `needs-json` | Yes      | The calling job's `needs`, as `toJSON(needs)`. |

## Usage

```yaml
ci-result:
  name: CI Result
  needs: [<repo-specific list>]
  if: ${{ !cancelled() && needs.ci-context.outputs.should-run-ci != 'false' }}
  runs-on: ubuntu-26.04
  permissions: {}
  steps:
    - name: Check job results
      uses: OpenSesame/core-github-actions/.github/actions/check-ci-result@<sha> # actions/check-ci-result/1.0.0
      with:
        needs-json: ${{ toJSON(needs) }}
```

Replace `<sha>` with the full commit SHA of the tag: `git rev-list -n1 actions/check-ci-result/1.0.0`.

The action needs no checkout and no GitHub token permissions. It uses `jq`, which is preinstalled on GitHub-hosted Ubuntu runners.

## Why an action and not a reusable workflow

- A reusable workflow can't read the caller's `needs`, so each caller would still have to pass the results in.
- A reusable workflow reports its checks as `CI Result / <job>`, which would rename the required check. As a step in the caller's own job, the check stays `CI Result`.

## Versioning

This action follows the repository's component versioning policy. The initial release uses the PR label `v:a/check-ci-result/1.0.0` and the namespaced tag `actions/check-ci-result/1.0.0`.
