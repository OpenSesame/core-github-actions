# Detect Deployable Changes

Decides whether a deploy can be skipped because only ignorable files changed since the last commit
whose deploy run passed a proof job, and outputs `should-deploy`. Any doubt deploys.

The workflow checks out the commit with full history, then runs the
[`detect-deployable-changes`](../../actions/detect-deployable-changes/README.md) action in one job.
Read that action's README for how it decides, the glob syntax, and its known limits. This workflow
holds the parts every caller would otherwise copy:

- the checkout of the right commit with full history
- the two read permissions
- a job timeout longer than the action's wait
- the runner

## Usage

```yaml
jobs:
  detect-deployable-changes:
    name: Detect Deployable Changes
    permissions:
      actions: read # Required to read earlier commits' dev deploy runs and their upload job results.
      contents: read # Required to check out the history the changes are diffed against.
    uses: OpenSesame/core-github-actions/.github/workflows/detect_deployable_changes.yml@<released-sha> # workflows/detect_deployable_changes/1.0.0
    with:
      mode: pull-request
      workflow-file: on_pr_deploy_dev.yml
      proof-job: Deploy Dev / Deploy App To S3 / Build and Apply to dev
      ignore-paths-file: .github/deploy-ignore
      ignore-paths: |
        .github/workflows/on_merge_deploy_thru_prod.yml
      deploy-paths: |
        public/**

  deploy-dev:
    name: Deploy Dev
    needs: detect-deployable-changes
    uses: ./.github/workflows/on_call_deploy_env.yml
    with:
      skip-deploy: ${{ needs.detect-deployable-changes.outputs.should-deploy == 'false' }}
      skip-reason: ${{ needs.detect-deployable-changes.outputs.reason }}
```

Resolve `<released-sha>` with `git rev-list -n1 workflows/detect_deployable_changes/1.0.0`. The
check is reported as `Detect Deployable Changes / Detect`.

The caller job must grant `actions: read` and `contents: read`. The workflow starts from
`permissions: {}`, and its job asks for nothing more.

In `pull-request` mode the workflow checks out the pull request's head. In `merge` mode it checks out
`github.sha`, which is the merge commit for a closed pull request. For any other event it checks out
`github.sha`, and the action deploys.

## Keeping a required check reporting

Pass `should-deploy == 'false'` into the deploy workflow as an input, and have that workflow end in
an `always()` result job that passes when told to skip.

Don't skip the deploy job with `if:`. A caller job skipped that way reports only its own name, so a
required check on an inner job stays pending.

Leave the deploy job on the implicit `success()`. If this workflow fails, nothing deploys, and the
required check never reports until someone re-runs it. A re-run always deploys.

## Inputs

| Input                   | Type   | Required | Default | Description                                                                                                 |
| ----------------------- | ------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `mode`                  | string | Yes      |         | `pull-request` or `merge`.                                                                                  |
| `workflow-file`         | string | Yes      |         | File name of the workflow whose earlier `pull_request` runs prove earlier deploys, usually the caller.      |
| `proof-job`             | string | Yes      |         | Full job name, as the jobs API lists it, whose success proves a run deployed its commit.                    |
| `proof-caller-job`      | string | No       | `''`    | Caller job whose `skipped` stands in for a missing proof job.                                               |
| `ignore-paths-file`     | string | No       | `''`    | Repository file listing ignorable globs, one per line. The file itself always deploys.                      |
| `ignore-paths`          | string | No       | `''`    | Extra ignorable globs, one per line.                                                                        |
| `deploy-paths`          | string | No       | `''`    | Globs that deploy even when an ignorable glob matches them.                                                 |
| `wait-timeout-minutes`  | number | No       | `40`    | Total wait for unfinished earlier runs before deploying.                                                    |
| `poll-interval-seconds` | number | No       | `30`    | How often to check an unfinished earlier run.                                                               |
| `max-commits`           | number | No       | `50`    | How many earlier commits to search for a verified one.                                                      |
| `timeout-minutes`       | number | No       | `50`    | Job timeout. Keep it above `wait-timeout-minutes`, so the action deploys before the job is cancelled.       |

The token is the job's `github.token`, with the caller's `actions: read` grant.

## Outputs

| Output          | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `should-deploy` | `'false'` when the deploy can be skipped, otherwise `'true'`.               |
| `reason`        | One line explaining the decision. Also written to the job summary.          |
| `verified-sha`  | The earlier commit whose deploy the decision relies on, empty when none.    |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md). When the action gets a new input, add it here too: the
workflow's tests fail until every action input but `github-token` is passed through.
