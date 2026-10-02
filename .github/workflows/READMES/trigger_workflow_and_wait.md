# Trigger a Workflow and Wait

This reusable workflow dispatches a `workflow_dispatch` workflow in another repository, discovers
the resulting run, waits for completion, and exposes the downstream run details to later jobs.

> **Warning:** The target workflow may perform deployments, cleanup, or other live-system changes.
> This workflow forwards the supplied JSON inputs without interpreting their meaning. Review the
> target repository, workflow, ref, and payload before invocation.

## Prerequisites

- The target workflow supports `workflow_dispatch` and accepts the keys in `client_payload`.
- The supplied token can read Actions runs and dispatch the target workflow in the target
  repository.
- The target repository and workflow are reachable through the GitHub API.

## Usage

```yaml
jobs:
  downstream:
    uses: OpenSesame/core-github-actions/.github/workflows/trigger_workflow_and_wait.yml@workflows/trigger_workflow_and_wait/0.1.0
    with:
      owner: OpenSesame
      repo: example-service
      workflow_file: on_dispatch_smoke_env.yml
      commit-identifier: main
      client_payload: '{"environment":"dev"}'
    secrets:
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

## Inputs

| Input               | Type   | Required | Default | Description                                                                  |
| ------------------- | ------ | -------- | ------- | ---------------------------------------------------------------------------- |
| `owner`             | string | Yes      | —       | Owner of the target repository.                                              |
| `repo`              | string | Yes      | —       | Target repository name.                                                      |
| `workflow_file`     | string | Yes      | —       | Filename of the target `workflow_dispatch` workflow.                         |
| `commit-identifier` | string | No       | `main`  | Branch, tag, or commit SHA passed as the dispatch ref.                       |
| `wait_interval`     | number | No       | `20`    | Seconds between downstream run discovery and status polling attempts.        |
| `client_payload`    | string | Yes      | —       | JSON object serialized as a string and sent as the target workflow's inputs. |

## Secrets

| Secret                                | Required | Description                                                                                                                                                     |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | Yes      | GitHub token used to list and dispatch Actions runs in the target repository. Despite its name, the token must have permission to dispatch the target workflow. |

## Outputs

| Output                | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `downstream_run_id`   | Numeric ID of the discovered downstream workflow run.                      |
| `downstream_html_url` | GitHub URL for the downstream workflow run.                                |
| `conclusion`          | Final downstream conclusion, such as `success`, `failure`, or `cancelled`. |

## Behavior

1. Installs `jq` with `apt-get` when it is not already available on the runner.
2. Validates that `client_payload` is JSON.
3. Records recent matching workflow-dispatch runs from the previous two minutes.
4. Dispatches `workflow_file` at `commit-identifier` with the supplied inputs.
5. Polls up to 60 times for a new matching run, waiting `wait_interval` seconds each time.
6. Polls the discovered run until it completes.
7. Fails when no run is discovered or when the downstream conclusion is not `success`.

Run discovery selects the newest run ID that appears after dispatch. The completion polling loop has
no independent maximum duration; it waits as long as the downstream run remains incomplete. The
workflow requests `id-token: write` and `contents: read` permissions in the caller repository.
The workflow job runs on Ubuntu 24.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
