# Run Repo Checks

Lints, format-checks and scans every technology in the repository, and validates it against the
repository standard, in one job. It detects which technologies the repository contains, calls the
per-technology workflow for each one it finds, and writes a summary table. Tool versions stay in the
repository: native tools in `mise.toml` with a lock file, and Node tools as npm devDependencies. CI
runs mise tasks for native tools and npm scripts for Node tools. Locally, `package.json` scripts
wrap both, so `npm run check` runs what CI runs.

## Usage

```yaml
jobs:
  repo-checks:
    name: Repo Checks
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_repo_checks.yml@<released-sha> # workflows/run_repo_checks/1.0.0
    permissions:
      contents: read # Required to check out the code to lint, format-check, scan and validate.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
      ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}
```

Add `repo-checks` to `ci-result`'s needs. Replace `<released-sha>` with the full commit SHA of the
tag: `git rev-list -n1 workflows/run_repo_checks/1.0.0`.

## Jobs

| Check                               | Runs when                           | Workflow                                          |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `Repo Checks / Detect`              | Always                              | —                                                 |
| `Repo Checks / GHA / Checks`        | GitHub Actions files are present    | [`run_gha_checks`](run_gha_checks.md)             |
| `Repo Checks / Terraform / …`       | Terraform files are present         | [`run_terraform_checks`](run_terraform_checks.md) |
| `Repo Checks / Markdown / …`        | Markdown files are present          | [`run_markdown_checks`](run_markdown_checks.md)   |
| `Repo Checks / Shell / …`           | Shell scripts are present           | [`run_shell_checks`](run_shell_checks.md)         |
| `Repo Checks / JS / …`              | JavaScript or TypeScript is present | [`run_js_checks`](run_js_checks.md)               |
| `Repo Checks / Standard / Validate` | Always                              | [`run_repo_validation`](run_repo_validation.md)   |
| `Repo Checks / Summary`             | Always, unless the run is cancelled | —                                                 |

A technology that isn't present skips its job, because Detect found none of its files. A technology
that is present but has no task or script for a step fails that step, and mise or npm logs why. Every
step runs even when an earlier one failed, as long as mise or `npm ci` set up, and the workflow fails
if any job failed.

## Detection

Detect looks only at tracked files (`git ls-files`), and ignores anything under `.core-services/`,
`node_modules/`, `.terraform/`, `dist/`, `build/`, `coverage/` and `vendor/` at any depth.

| Technology     | Files                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------- |
| GitHub Actions | `.github/workflows/*.yml` or `.yaml`, and `.github/actions/**/action.yml` or `.yaml`      |
| Terraform      | `*.tf`                                                                                    |
| Markdown       | `*.md`                                                                                    |
| Shell          | `*.sh`, `*.bash`, `*.zsh`, and files whose first line is an `sh`, `bash` or `zsh` shebang |
| JS             | `*.js`, `*.mjs`, `*.cjs`, `*.jsx`, `*.ts`, `*.mts`, `*.cts`, `*.tsx`                      |

## Setup

The GHA, Terraform and Shell jobs set up mise and run mise tasks; they don't need Node or `npm ci`.
Commit `mise.toml` and its lock file for Macs and runners
(`mise lock --platform linux-x64,macos-arm64`). The Markdown and JS jobs use Node from `.nvmrc` and
run `npm ci --ignore-scripts`, so commit `.nvmrc` and `package-lock.json`. Pass
`ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` if the repository depends on private `@opensesame` packages.

| Technology     | CI runs                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| GitHub Actions | mise tasks `lint:gha`, `scan:gha`                                                                         |
| Terraform      | mise tasks `init:terraform`, `validate:terraform`, `lint:terraform`, `format:terraform`, `scan:terraform` |
| Shell          | mise tasks `lint:shell`, `format:shell`                                                                   |
| Markdown       | npm script `lint:markdown`                                                                                |
| JS             | npm scripts `lint:js`, `format:prettier`                                                                  |

Format tasks and scripts check and never write. For each mise task, add a `package.json` script of
the same name that runs it, such as `"lint:gha": "mise run lint:gha"`. Then add `lint`, `format`,
`scan` and `check` aggregates with `npm-run-all --continue-on-error`, so `npm run check` runs
everything locally. CI calls only the specific tasks and scripts.

Repository validation needs the validator kit at `.core-services/generated/validate-repo.mjs`. Pass
`ORG_READ_ONLY_SSH_KEY` so it can warn when a newer validator release exists; without it, it
validates without that check.

## Summary

The Summary job writes a table of each technology's file count, init, validate, lint, format and scan
results, and baselined count, followed by the Standard result. Init and Validate apply only to
Terraform. A baselined issue is an inline ignore comment
(`zizmor: ignore`, `#checkov:skip=`, `tflint-ignore`, `markdownlint-disable`, `shellcheck disable=`,
`eslint-disable`, `prettier-ignore`) or an entry in a tracked `*.checkov.baseline` file.

## Inputs

| Input               | Default               | Description                         |
| ------------------- | --------------------- | ----------------------------------- |
| `commit-identifier` | Triggering ref or SHA | Commit SHA, tag, or branch to check |

## Secrets

| Secret                                | Required | Description                                                                                                                         |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ORG_READ_ONLY_SSH_KEY`               | No       | Read-only SSH key that can read OpenSesame/core-services-ai-tooling                                                                 |
| `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` | No       | Read-only token for the org's GitHub Packages npm registry, passed to the Markdown and JS checks for private `@opensesame` packages |

## Contribution

The jobs call the per-technology workflows with `./` references, which GitHub resolves to this
repository at the same commit as `run_repo_checks`, as `tf_plan_env_roots` does. So a change
to one of them also changes `run_repo_checks`: release both in the same pull request, with a version
label and changelog entry for each. Update the workflow, README, and changelog together, and set the
version labels per [VERSIONING.md](../../../VERSIONING.md).
