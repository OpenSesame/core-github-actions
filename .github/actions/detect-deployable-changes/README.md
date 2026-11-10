# Detect Deployable Changes

## Summary

Decides whether a deploy can be skipped because nothing it publishes changed. It compares the
commit being deployed with the last earlier commit whose deploy run passed a proof job you name,
and outputs `should-deploy`. Any doubt deploys, so the gate can only cost time, never coverage.

It has two modes:

- `pull-request` gates a pull request's deploy, for example to dev. It skips when everything since
  the pull request's newest commit whose run passed the proof job is ignorable, or when the whole
  pull request changes only ignorable files and none of its commits were deployed.
- `merge` gates a merged pull request's deploy through prod. It skips when everything since the
  base branch's newest merge whose run passed the proof job is ignorable.

The rules come from core-mfe-profile-manager's CORE-6211 gate, with its MFE-specific file list,
workflow and job names made inputs.

## How it decides

These always deploy:

- any event other than `pull_request`, such as `workflow_dispatch`
- a re-run (`GITHUB_RUN_ATTEMPT` above 1)
- in `pull-request` mode: a reopened pull request, any action other than `opened` and
  `synchronize` (such as `labeled` or `ready_for_review`), a force-push, an empty push, and a push
  that changes any deployable file
- in `merge` mode: a pull request closed without merging
- an earlier run that failed or was cancelled, or whose proof job is missing
- an earlier run still unfinished after `wait-timeout-minutes`
- no verified commit among the `max-commits` newest
- any error: an API error, a git error, a shallow checkout, a bad input or an unsupported glob

Finding the last deployed commit:

- It reads only `pull_request` runs of `workflow-file`, so manual deploys never count.
- A run proves its commit only when the run concluded `success` **and** the `proof-job` job
  concluded `success`.
- A successful run whose proof job was `skipped` is passed over. That run was skipped by this gate,
  or superseded by a newer push. So is a commit with no run of its own. The diff then starts from
  an older verified commit, so nothing passed over goes unchecked.
- In `merge` mode a merge's run is found under its pull request's head, the merge commit's second
  parent. The repository must merge pull requests with merge commits. With squash or rebase merges
  the gate finds no verified merge and always deploys.
- A queued or running earlier run is polled every `poll-interval-seconds` until it finishes or
  `wait-timeout-minutes` passes in total.

## Ignorable paths

A path is ignorable when an `ignore-paths-file` or `ignore-paths` glob matches it and no
`deploy-paths` glob does. Every other path deploys, including paths added later, so list only what
can never change what the deploy publishes or tests. The `ignore-paths-file` itself always deploys,
so a change to the list is never judged by the list.

Globs match the whole path from the repository root, as git's glob pathspecs do:

- `*` and `?` never cross a `/`.
- A `**` segment matches any number of directories.
- A trailing `/` matches everything under the folder (`docs/` is `docs/**`).
- Dot files and dot folders match like any other path.
- `*.md` matches only Markdown at the root. Use `**/*.md` for any depth.
- `[...]`, `{...}`, `!` and `\` are refused, and the gate then deploys.

Diffs use `--no-renames`, so moving a file out of an ignored folder deploys.

## Permissions

```yaml
permissions:
  actions: read # Required to read earlier deploy runs and their jobs.
  contents: read # Required to check out the history the changes are diffed against.
```

## Dependencies

- A checkout of the commit being deployed with full history (`fetch-depth: 0`). A shallow checkout
  deploys with a warning.
- `git` at `/usr/bin/git`, as on GitHub-hosted Ubuntu runners.

## Inputs

| Name                    | Required | Default               | Description                                                                                                           |
| ----------------------- | -------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mode`                  | Yes      |                       | `pull-request` or `merge`.                                                                                            |
| `workflow-file`         | Yes      |                       | File name of the workflow whose `pull_request` runs prove earlier deploys, such as `on_pr_deploy_dev.yml`.            |
| `proof-job`             | Yes      |                       | Full job name as the jobs API lists it, such as `Deploy Dev / Deploy App To S3 / Build and Apply to dev`.             |
| `proof-caller-job`      | No       | `''`                  | Caller job whose `skipped` stands in for a missing proof job, when the caller skips a reusable call before it starts. |
| `ignore-paths-file`     | No       | `''`                  | Repository file with one ignorable glob per line; `#` starts a comment.                                               |
| `ignore-paths`          | No       | `''`                  | Extra ignorable globs, one per line, usually the ones only this mode ignores.                                         |
| `deploy-paths`          | No       | `''`                  | Globs that deploy even when an ignorable glob matches them.                                                           |
| `wait-timeout-minutes`  | No       | `40`                  | Total wait for unfinished earlier runs before deploying.                                                              |
| `poll-interval-seconds` | No       | `30`                  | How often to check an unfinished earlier run.                                                                         |
| `max-commits`           | No       | `50`                  | How many earlier commits to search for a verified one.                                                                |
| `github-token`          | No       | `${{ github.token }}` | Token that can read the repository's Actions runs.                                                                    |

## Outputs

| Name            | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `should-deploy` | `'false'` when the deploy can be skipped, otherwise `'true'`.            |
| `reason`        | One line explaining the decision. Also written to the step summary.      |
| `verified-sha`  | The earlier commit whose deploy the decision relies on, empty when none. |

## Usage

```yaml
detect-deployable-changes:
  name: Detect Deployable Changes
  runs-on: ubuntu-26.04
  permissions:
    actions: read # Required to read earlier commits' dev deploy runs and their upload job results.
    contents: read # Required to check out the history the changes are diffed against.
  # Covers waiting for the previous push's run; the action deploys if its wait times out.
  timeout-minutes: 50
  outputs:
    should-deploy: ${{ steps.detect.outputs.should-deploy }}
    reason: ${{ steps.detect.outputs.reason }}
  steps:
    - name: Check out commit
      uses: actions/checkout@<sha> # <version>
      with:
        ref: ${{ github.event.pull_request.head.sha || github.sha }}
        fetch-depth: 0
        persist-credentials: false

    - name: Detect deployable changes
      id: detect
      uses: OpenSesame/core-github-actions/.github/actions/detect-deployable-changes@<sha> # actions/detect-deployable-changes/1.0.0
      with:
        mode: pull-request
        workflow-file: on_pr_deploy_dev.yml
        proof-job: Deploy Dev / Deploy App To S3 / Build and Apply to dev
        ignore-paths-file: .github/deploy-ignore
        ignore-paths: |
          .github/workflows/on_merge_deploy_thru_prod.yml
        deploy-paths: |
          public/**
```

Replace `<sha>` with the full commit SHA of the tag:
`git rev-list -n1 actions/detect-deployable-changes/1.0.0`.

Check out the pull request's head in `pull-request` mode and `github.sha`, the merge commit, in
`merge` mode.

## Keeping a required check reporting

The action only decides. To skip a deploy whose result is a required check:

- Pass `should-deploy == 'false'` into the deploy workflow as an input, for example `skip-deploy`.
- Have the deploy workflow skip its jobs and end in an `always()` result job that passes when told
  to skip.
- Don't skip the caller job with `if:`. A caller job skipped that way reports only its own name,
  never `Caller / Result`, so a required check on the inner job stays pending.
- Leave the caller job on the implicit `success()`. If the gate job itself fails, nothing deploys
  and the required check never reports, which blocks the merge until someone re-runs it, and a
  re-run always deploys.

Choose a `proof-job` that succeeds only when the deploy happened. A result job that also passes for
skipped or superseded runs proves nothing.

## Known limits

- In `merge` mode, the gate checks only each merge's own run. A failed manual deploy, or a failed
  re-run of an older merge, after the last verified merge is not seen. A later merge of only
  ignorable files then skips, and the environment stays as that deploy left it until a deployable
  merge or a manual redeploy.
- For the same reason, a successful manual deploy, such as a rollback, isn't overwritten by a later
  merge of only ignorable files.
- Renaming the proof job or its callers makes earlier runs unverifiable. The gate then deploys until
  a run under the new names exists.

## Versioning

This action follows the repository's component versioning policy. The initial release uses the PR
label `v:a/detect-deployable-changes/1.0.0` and the namespaced tag
`actions/detect-deployable-changes/1.0.0`.
