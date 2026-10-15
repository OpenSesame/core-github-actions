# Run Infra CI

This reusable workflow runs infrastructure and repository-configuration checks whose tools have no npm
installer. This release checks GitHub Actions workflows and actions with
[actionlint](https://github.com/rhysd/actionlint) (including shellcheck for `run` scripts) and
[zizmor](https://docs.zizmor.sh/). Each tool runs in its own job, through tasks the consuming
repository defines in a committed `mise.toml`, so engineers run the same command locally.

## Usage

```yaml
jobs:
  infra-ci:
    name: Infra CI
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_infra_ci.yml@<released-sha> # workflows/run_infra_ci/1.0.0
    permissions:
      contents: read # Required to check out the workflows to lint and audit.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

The checks are reported as `Infra CI / Lint GHA` and `Infra CI / Scan GHA`. Add `infra-ci` to the
caller's `ci-result` needs. The workflow has no per-tool switches; new tools arrive as new required
tasks in a major release.

## Contract: `mise.toml`

The consuming repository commits a `mise.toml` at its root with these tasks. Task names describe
what is checked, not the tool, and later tools follow the same `action:subject` pattern, such as
`lint:markdown` or `scan:terraform`:

| Task       | Runs                                          |
| ---------- | --------------------------------------------- |
| `lint:gha` | actionlint, with shellcheck for `run` scripts |
| `scan:gha` | zizmor on `.github`                           |
| `infra-ci` | both tasks                                    |

Copy this template, keeping the tasks as written:

```toml
[tools]
"aqua:rhysd/actionlint" = "1.7.12"
"aqua:koalaman/shellcheck" = "0.11.0"
"aqua:zizmorcore/zizmor" = "1.29.0"

[tasks."lint:gha"]
description = "Lint GitHub Actions workflows"
run = "actionlint"

[tasks."scan:gha"]
description = "Audit GitHub Actions workflows for security issues"
run = "zizmor .github"

[tasks.infra-ci]
description = "Run every infra-ci check"
depends = ["lint:gha", "scan:gha"]
```

Then generate the lockfile for both developer Macs and the CI runners, and commit it:

```shell
mise lock --platform linux-x64,macos-arm64
```

Rules:

1. `[tools]` holds infra-ci tools only. Node.js and npm stay on `.nvmrc` and `actions/setup-node`.
2. Every tool names its backend explicitly, using a backend that verifies downloads. The `aqua:`
   backend checks each download against the registry's checksums, and actionlint and zizmor also
   carry GitHub artifact attestations. The aqua registry has no checksum for shellcheck, so the
   committed `mise.lock` is what pins its download.
3. Each required task is a single command with no arguments of its own beyond its target. The
   workflow appends GitHub annotation flags (`mise run <task> -- <flags>`), and engineers
   run the task bare.
4. `mise.lock` covers `linux-x64` and `macos-arm64`. When a lockfile is present, `jdx/mise-action`
   installs with `--locked`, so CI downloads must match the recorded URLs and checksums. Renovate's
   mise manager regenerates `mise.lock` when it bumps a tool, and `mise lock` keeps the platforms
   already in the file.

If `mise.toml` or a job's task is missing, that job fails with a link to this README.

npm repositories may add one pointer script per tool, for example
`"lint:gha": "mise run lint:gha"` and `"scan:gha": "mise run scan:gha"`. Keep `lint` and `scan`
themselves as explicit commands, not `lint:*` or `scan:*` globs, so `app-ci` steps such as
`npm run lint` don't need mise.

## Suppressing findings

Fix findings, including existing ones found when a repository adopts infra-ci. Suppress a finding only
when it can't be fixed: a false positive, or a pattern the code needs on purpose. Each tool keeps its
suppressions in its own config file at a fixed location:

| Tool       | File                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| actionlint | `.github/actionlint.yaml` (`paths.<glob>.ignore` patterns)                     |
| zizmor     | `.github/zizmor.yml` (`rules.<id>.ignore`), or inline `# zizmor: ignore[<id>]` |

Rules:

1. Suppress a specific finding (a file and rule, or a file, line and rule). Never disable a rule
   for the whole repository.
2. Every entry has a comment explaining why the finding can't be fixed. Suppressions are permanent,
   so they have no follow-up ticket.
3. New findings always fail.
4. Prefer inline zizmor comments to line-number ignores, which break when the file changes.

Each job summary reports how many suppressions its config file holds.

`actionlint.yaml` also carries configuration that is not a suppression. No actionlint release yet
knows the `ubuntu-26.04` runner label, so declare it until one does:

```yaml
self-hosted-runner:
  labels:
    - ubuntu-26.04
```

## Jobs

Each job checks out `commit-identifier` without persisting credentials, verifies the contract,
installs mise 2026.9.17 with `jdx/mise-action` (version and binary checksum pinned), installs the
tools from `mise.toml`, runs its task, and writes a job summary with the result, the suppression
count, and the local command.

| Job        | Command in CI                                         | Local command       |
| ---------- | ----------------------------------------------------- | ------------------- |
| `lint-gha` | `mise run lint:gha -- -format '<GitHub annotations>'` | `mise run lint:gha` |
| `scan-gha` | `mise run scan:gha -- --format=github`                | `mise run scan:gha` |

zizmor runs with `GH_TOKEN` set to the job's `github.token`, which enables its online audits, such
as known-vulnerable actions and impostor commits. Locally it runs offline unless `GH_TOKEN` is set.

## Inputs

| Input               | Type   | Required | Default               | Description                              |
| ------------------- | ------ | -------- | --------------------- | ---------------------------------------- |
| `commit-identifier` | string | No       | Triggering ref or SHA | Commit SHA, tag, or branch to check out. |

## Permissions

| Permission | Reason                                             |
| ---------- | -------------------------------------------------- |
| `contents` | `read`: check out the workflows to lint and audit. |

The workflow jobs run on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [actionlint configuration](https://github.com/rhysd/actionlint/blob/main/docs/config.md)
- [zizmor configuration](https://docs.zizmor.sh/configuration/)
- [mise tasks](https://mise.jdx.dev/tasks/) and [mise.lock](https://mise.jdx.dev/dev-tools/mise-lock.html)
