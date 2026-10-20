# Run Infra CI

Lints GitHub Actions workflows with [actionlint](https://github.com/rhysd/actionlint) (and shellcheck)
and audits them with [zizmor](https://docs.zizmor.sh/), through tasks in the repo's `mise.toml`, so
CI and engineers run the same pinned tools.

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

Checks are reported as `Infra CI / Lint GHA` and `Infra CI / Scan GHA`. Add `infra-ci` to `ci-result`'s
needs.

## Setup

1. Commit this `mise.toml` at the repo root (infra tools only; Node stays on `.nvmrc`):

   ```toml
   [tools]
   "aqua:rhysd/actionlint" = "1.7.12"
   "aqua:koalaman/shellcheck" = "0.11.0"
   "aqua:zizmorcore/zizmor" = "1.29.0"

   [tasks."lint:gha"]
   run = "actionlint"

   [tasks."scan:gha"]
   run = "zizmor --offline .github"

   [tasks.infra-ci]
   depends = ["lint:gha", "scan:gha"]
   ```

2. Commit a lockfile for Macs and CI runners: `mise lock --platform linux-x64,macos-arm64`.
3. Declare the runner label actionlint doesn't know yet in `.github/actionlint.yaml`:

   ```yaml
   self-hosted-runner:
     labels:
       - ubuntu-26.04
   ```

4. npm repos: add `"lint:gha": "mise run lint:gha"` and `"scan:gha": "mise run scan:gha"`. CI calls
   specific scripts, never the `lint`/`scan` aggregates, so CI jobs don't need mise.

Run locally with `mise run infra-ci`. zizmor runs `--offline` locally and in CI: its online audits need a
token that can read the org's private action repos.

## Findings

Fix findings. Suppress only false positives or intentional patterns, one specific finding at a time,
each with a comment explaining why:

- actionlint: `.github/actionlint.yaml` `paths.<glob>.ignore`
- zizmor: inline `# zizmor: ignore[<rule>] <reason>`, or `.github/zizmor.yml` `rules.<rule>.ignore`

## Inputs

| Input               | Default               | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to check |

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
