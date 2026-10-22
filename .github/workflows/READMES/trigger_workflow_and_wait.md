# Trigger a Workflow and Wait

This reusable workflow dispatches a `workflow_dispatch` workflow in another repository, waits for
the run that dispatch created to complete, and exposes the downstream run details to later jobs.

> **Warning:** The target workflow may perform deployments, cleanup, or other live-system changes.
> This workflow forwards the supplied JSON inputs without interpreting their meaning. Review the
> target repository, workflow, ref, and payload before invocation.

## Prerequisites

- The target workflow supports `workflow_dispatch` and accepts the keys in `client-payload`.
- `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` can dispatch the target workflow: **Actions: write** on the
  target repository for a fine-grained token or GitHub App, or the `repo` scope for a classic token.

## Usage

```yaml
jobs:
  downstream:
    uses: OpenSesame/core-github-actions/.github/workflows/trigger_workflow_and_wait.yml@workflows/trigger_workflow_and_wait/1.0.0
    with:
      owner: OpenSesame
      repo: example-service
      workflow-file: on_dispatch_smoke_env.yml
      commit-identifier: main
      client-payload: '{"environment":"dev"}'
    secrets:
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

The workflow declares `permissions: {}`, so the caller job does not need to grant any.

## Inputs

| Input               | Type   | Required | Default | Description                                                     |
| ------------------- | ------ | -------- | ------- | --------------------------------------------------------------- |
| `owner`             | string | Yes      | —       | Owner of the target repository.                                 |
| `repo`              | string | Yes      | —       | Target repository name.                                         |
| `workflow-file`     | string | Yes      | —       | Filename of the target `workflow_dispatch` workflow.            |
| `commit-identifier` | string | No       | `main`  | Branch or tag passed as the dispatch ref.                       |
| `wait-interval`     | number | No       | `20`    | Seconds between downstream run status polls.                    |
| `client-payload`    | string | Yes      | —       | JSON object, as a string, sent as the target workflow's inputs. |

## Outputs

| Output                | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `downstream-run-id`   | ID of the downstream run created by the dispatch.                          |
| `downstream-html-url` | GitHub URL of the downstream run.                                          |
| `conclusion`          | Final downstream conclusion, such as `success`, `failure`, or `cancelled`. |

## Behavior

- Dispatches with `return_run_details: true` and waits on the run ID in the response, so concurrent
  dispatches of the same workflow by other callers are never picked up. Fails if the response has
  no run ID.
- Polls until the run completes, with no maximum duration, and fails unless it concludes `success`.

## Migrating from 0.x

Rename inputs `workflow_file`, `wait_interval`, `client_payload` and outputs `downstream_run_id`,
`downstream_html_url` to their kebab-case forms above. Caller-side `id-token: write` and
`contents: read` grants made only for this workflow can be removed.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
