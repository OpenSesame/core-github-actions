# Core Services Repository Validator

This directory is an intentionally committed, offline repository-standards kit. Its canonical
maintainable source and regression suite live in
[`OpenSesame/core-services-ai-tooling`](https://github.com/OpenSesame/core-services-ai-tooling),
under `library/repository-validator/`. Consumer repositories receive a single generated runtime and
the readable configuration files needed to inspect and run it without GitHub or npm access.

## What Validation Covers

The validator compares the tracked GitHub Actions workflows and composite actions with the bundled
Core Services standard:

- `on_push_ci.yml` triggers, the `commit-identifier` dispatch input, and the required jobs and
  check names for the detected surfaces (npm, Terraform). App CI is required only when a
  `package.json` defines a `build` or `test` script, or one under those prefixes such as
  `test:unit`. Without them, App CI would only run `npm ci --ignore-scripts`, which installs
  dependencies and that Repo Checks already does. It doesn't run any other script, so a build or
  test script with another name, such as `verify`, still needs its own CI job.
- `CI Result` wiring through `check-ci-result`
- core-github-actions calls pinned to a release SHA with a `# <component>/<x.y.z>` comment at or
  above the minimum release
  (core-github-actions' own CI calls its components as `./.github/workflows/<name>.yml` or
  `./.github/actions/<name>`, so each change runs the versions it changes; the validator accepts
  those only when the `origin` remote is `OpenSesame/core-github-actions`)
- `permissions: {}` at the top of every workflow and a reason comment on every granted permission
- the `ubuntu-26.04` runner and no `ubuntu-latest`
- `--ignore-scripts` on every `npm ci` and `npm install`
- Node and npm floors: a major-only `.nvmrc`, `engines.node` with a major ceiling that matches
  it, an `engines.npm` floor at or above 11.10.0 that the npm shipped with the `engines.node` floor
  meets, `engine-strict=true` and `min-release-age` of at
  least 7 days in `.npmrc`, no `packageManager` npm pin, and no global npm installs in workflows
- the `repo-checks` job that calls core-github-actions `run_repo_checks`, and the mise tasks, npm
  scripts, lock files and actionlint runner label it needs for each detected technology
- kebab-case workflow inputs and the `on_call_` / `on_dispatch_` file prefixes
- the repository baseline: required files, no committed secrets or Terraform state, the Core
  `.editorconfig`, VS Code extensions and settings, and tool configs (see Repository Baseline)

It does not repeat what actionlint and zizmor already report.

Validation does not execute repository tasks, run workflows, contact live
systems, or replace normal human code review, tests, security review, and deployment controls. The
human author owns all AI-assisted output and remains responsible for the repository change.

## Standard And Contract

- `.core-services/repository-standard.json` is the centrally managed snapshot of current Core
  Services requirements.
- `.core-services/repository-contract.json` is owned by this repository. It records justified
  exceptions.
- `.core-services/repository-contract.schema.json` describes the contract document shape. The
  validator also applies standard-dependent checks that JSON Schema alone cannot express.

Start with `templates/repository-contract.minimal.json`. Copy the object in
`templates/contract-exception.example.json` into the contract's `exceptions` array only when there
is a specific requirement, rationale, accountable owner, and optionally paths and a review date. The
standard lists the requirements no exception can waive, such as the required CI jobs, CI Result,
core-github-actions pins, permissions, runner, and npm install rules.

## File Ownership

The repository owns only `.core-services/repository-contract.json` and its repository-specific
exceptions, workflows, and documentation.

The following files are generated or centrally managed and must not be edited directly:

- `.core-services/README.md`
- `.core-services/generated/validate-repo.mjs`
- `.core-services/repository-contract.schema.json`
- `.core-services/repository-standard.json`
- `.core-services/templates/*.json`
- `.core-services/validator-manifest.json`

The bundle is committed intentionally as the deployable offline artifact; it is not accidental
build output. `validator-manifest.json` records its validator and standard versions, every managed
file checksum, and the exact clean ai-tooling source commit used to install or update it.

## Run And Interpret Validation

With the repository's Node version:

```sh
node .core-services/generated/validate-repo.mjs
node .core-services/generated/validate-repo.mjs --json
```

- Passes confirm a requirement the validator could inspect.
- Warnings identify something the validator cannot confirm statically, such as a computed
  `runs-on`, or a warning-level exception.
- Policy failures exit `1` and require a repository change or a justified exception where the
  standard permits one.
- Operational or invocation failures exit `2` and identify malformed input, missing required files,
  unsupported arguments, or a validator execution problem.

The validator inspects visible local configuration; a passing result does not prove behavior that
is hidden behind task execution, external services, generated infrastructure, or deployment.

## Run In CI

Installing the kit does not run validation in CI. CI runs it through the `repo-checks` job, which
calls core-github-actions `run_repo_checks`. Its `Standard` job runs the installed bundle and
reports `Repo Checks / Standard / Validate`. Add the job to `on_push_ci.yml` and to `ci-result`'s
`needs` so the `CI Result` required check fails with it. Replace `<sha>` with the full commit SHA
of the release named in the comment: `git rev-list -n1 workflows/run_repo_checks/1.0.2` in
core-github-actions.

```yaml
  repo-checks:
    name: Repo Checks
    needs: ci-context
    if: ${{ needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_repo_checks.yml@<sha> # workflows/run_repo_checks/1.0.2
    permissions:
      contents: read # Required to check out the code to lint, format-check, scan and validate.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
    secrets:
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
```

Pass `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN: ${{ secrets.ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN }}` as
well when the repository installs private `@opensesame` packages.

The validator enforces this wiring itself. It requires the job in every repository, with exactly
`contents: read`, the `ORG_READ_ONLY_SSH_KEY` secret passed by name (not `secrets: inherit`), no
`continue-on-error`, the `ci-context` gate and commit, and a pin at or above
`workflows/run_repo_checks/1.0.2`. While `.core-services/validator-manifest.json` exists, it also
fails when a managed file no longer matches the manifest checksums, or when the manifest and the
installed bundle disagree on the validator version. A repo-owned job that runs the bundle is no
longer needed; remove it once Repo Checks runs.

With the key, the Standard job reads the newest `repository-validator/<x.y.z>` tag from
core-services-ai-tooling and passes it as `--latest-version`. An older installed kit is a warning,
not a failure; run update to clear it. Without the key, or if the lookup fails, the job validates
without that check. The validator itself stays offline.

### Repo Checks Prerequisites

`run_repo_checks` detects technologies from tracked files outside `.core-services/`,
`node_modules/`, `.terraform/`, `dist/`, `build/`, `coverage/` and `vendor/`, then runs mise tasks
and npm scripts by name. The validator uses the same detection and requires what each check runs:

- GitHub Actions (`.github/workflows/*.yml` and `.github/actions/**/action.yml`): mise tasks
  `lint:gha` and `scan:gha`, which must run `zizmor --offline`, and the `ubuntu-26.04` label under
  `self-hosted-runner.labels` in `.github/actionlint.yaml`
- Terraform (`*.tf`): mise tasks `init:terraform`, which must use `-lockfile=readonly`,
  `validate:terraform`, `lint:terraform`, `format:terraform` and `scan:terraform`, and a committed
  `.terraform.lock.hcl` in each root
- Shell (`*.sh`, `*.bash`, `*.zsh`, or a first line with an sh, bash or zsh shebang): mise tasks
  `lint:shell` and `format:shell`
- Markdown (`*.md`): npm script `lint:markdown`
- JS (`*.js`, `*.mjs`, `*.cjs`, `*.jsx`, `*.ts`, `*.mts`, `*.cts`, `*.tsx`): npm scripts `lint:js`
  and `format:prettier`

Every repository also needs:

- `mise.toml` and `mise.lock`, with every tool in `[tools]` locked for `linux-x64` and
  `macos-arm64` (`mise lock --platform linux-x64,macos-arm64`). Tools from backends that mise
  locks without platform artifacts, such as `pipx:`, `go:`, `cargo:` and `gem:`, only need a lock
  entry. An `npm:` tool fails: move it to `package.json` `devDependencies`, since mise holds only
  native tools.
- mise tasks as `[tasks."<name>"]` tables or as keys of one `[tasks]` table. The required flags,
  such as `--offline` and `-lockfile=readonly`, must be in the task's `run` command, not in its
  description or a comment.
- `.nvmrc`, and `package-lock.json` when Markdown or JS is present
- a `package.json` script for each mise task that runs it, such as
  `"lint:gha": "mise run lint:gha"`
- `lint`, `format`, `scan` and `check` scripts that are each one
  `npm-run-all --continue-on-error` command, where `lint`, `format` and `scan` run every required
  script with their prefix and `check` runs every required script, so `npm run check` runs what
  Repo Checks runs. An aggregate with no required script under its prefix is optional.

A Terraform root is a directory with `*.tf` files that is not under a `modules/` directory and is
not called as a local module (`source = "./…"` or `"../…"` in a `module` block) from another
directory. These findings
report under `repo-checks-prerequisites`, which a path-scoped contract exception can waive, for
example for a root that is being deleted.

## Repository Baseline

Every repository commits the same baseline files. The validator checks them so editors and CI
agree on formatting before a change reaches review. Each rule reports under its own requirement,
which a path-scoped contract exception can waive.

- `required-files`: a non-empty `README.md`, `AGENTS.md`, `.gitignore`, `.editorconfig`,
  `.vscode/extensions.json`, `.vscode/settings.json`, and `CODEOWNERS` in `.github/`, the root,
  or `docs/`.
- `committed-secrets`: no tracked `.terraform/` directory, Terraform state, saved plans,
  `.tfvars` values or CLI credentials, `.env` files (`.env.example`, `.env.sample`,
  `.env.template` and `.env.tpl` are fine), private keys or certificates, or cloud credential
  files.
- `editorconfig`: `root = true`, and `[*]` sets `charset = utf-8`, `end_of_line = lf`,
  `indent_size = 2`, `indent_style = space`, `insert_final_newline = true` and
  `trim_trailing_whitespace = true`. `[*.md]` sets `trim_trailing_whitespace = false`, and
  `[Makefile]` sets `indent_style = tab` when there is a Makefile. The section headers must be
  exactly `[*]`, `[*.md]` and `[Makefile]`; a brace list such as `[*.{md,markdown}]` doesn't
  count. Other sections and properties are the repository's own.
- `vscode-extensions`: `.vscode/extensions.json` recommends `editorconfig.editorconfig` and
  `streetsidesoftware.code-spell-checker`, plus, for each technology Repo Checks detects:
  - GitHub Actions: `github.vscode-github-actions`, `redhat.vscode-yaml`
  - Terraform: `hashicorp.terraform`
  - Markdown: `davidanson.vscode-markdownlint`
  - Shell: `timonwong.shellcheck`, `foxundermoon.shell-format`
  - JS: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`
- `vscode-settings`: `.vscode/settings.json` formats on save with the formatter each check uses,
  so saving never produces a diff Repo Checks rejects. Other settings are the repository's own.

  ```jsonc
  {
    "editor.formatOnSave": true,
    "editor.rulers": [100],
    // Markdown
    "[markdown]": { "editor.defaultFormatter": null },
    // Terraform
    "[terraform]": { "editor.defaultFormatter": "hashicorp.terraform" },
    "[terraform-vars]": { "editor.defaultFormatter": "hashicorp.terraform" },
    // Shell
    "[shellscript]": { "editor.defaultFormatter": "foxundermoon.shell-format" },
    // JS: Prettier formats JavaScript, TypeScript, JSON and YAML; ESLint fixes on save
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "prettier.requireConfig": true,
    "yaml.format.enable": false,
    "eslint.format.enable": false,
    "editor.codeActionsOnSave": { "source.fixAll.eslint": "always" },
    "[javascript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[javascriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[jsonc]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[yaml]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  }
  ```

  Include only the groups for the technologies the repository has.
- `tool-configs`: the tools Repo Checks runs have Core configuration instead of their defaults:
  `.tflint.hcl` and `.checkov.yml` for Terraform, a markdownlint-cli2 config such as
  `.markdownlint-cli2.yaml` for Markdown, and an ESLint config such as `eslint.config.mjs` and a
  Prettier config (`.prettierrc`, `prettier.config.*`, or a `prettier` key in `package.json`,
  which may name a shared config) for JS. A `.cjs` or `.mjs` config file is itself JavaScript, so
  it also makes Repo Checks and the validator see JS. The actionlint runner label is checked with
  the Repo Checks prerequisites.

## Install, Update, And Status

Run lifecycle commands from a clean `core-services-ai-tooling` checkout so provenance can be tied to
its exact `HEAD`:

```sh
node scripts/repository-validation/repository-validator.mjs install /path/to/consumer
node scripts/repository-validation/repository-validator.mjs install /path/to/consumer --dry-run
node scripts/repository-validation/repository-validator.mjs update /path/to/consumer
node scripts/repository-validation/repository-validator.mjs update /path/to/consumer --dry-run
node scripts/repository-validation/repository-validator.mjs status /path/to/consumer
```

Install creates a minimal contract only when one is absent. Update preserves the contract's
exceptions, moves its standard reference to the new version, and refuses to replace a generated
file whose checksum differs from the installed manifest. Both commands add the generated-file marker
to `.gitattributes` and the disposable debug-source path to `.gitignore`. They also keep every
centrally managed file out of formatting, linting, and scans while
`.core-services/repository-contract.json` stays in scope:

- `.prettierignore` and `.semgrepignore` get `.core-services/*` followed by
  `!.core-services/repository-contract.json`. Earlier kit entries such as
  `.core-services/generated/` or `.core-services/**` are replaced in place. A new `.semgrepignore`
  repeats Semgrep's default ignore list, because the file replaces those defaults.
- `sonar.exclusions` in `sonar-project.properties`, when that file exists, gets the managed paths
  `.core-services/*/**`, `.core-services/README.md`, `.core-services/repository-contract.schema.json`,
  `.core-services/repository-standard.json`, and `.core-services/validator-manifest.json`. Sonar has
  no negation, so an earlier `.core-services/**` entry is removed.
- When the repository has an ESLint config, they print a reminder to add `.core-services/**` to its
  ignores. ESLint lints no JSON there, so it can skip the whole directory. They do not edit ESLint
  config.

Other content stays untouched. They do not stage, commit, push, or access the network.

Status is read-only and reports installed provenance, current, missing, modified, and stale managed
files separately from contract problems. When checksums drift, do not edit the manifest or generated
file to make status pass. Inspect the diff, preserve any useful discovery in the canonical source,
restore the installed generated file from version control if appropriate, and run update again.
Malformed or unrecognized manifests require manual inspection before any update.

## Debug Unbundled Source

Materialize readable source from a clean ai-tooling checkout without changing the normal validation
task. The lifecycle commands run from the ai-tooling checkout. The validator checks its current
directory, so run the debug copy from the consumer repository; run elsewhere, it validates that
directory instead.

```sh
node scripts/repository-validation/repository-validator.mjs materialize-source /path/to/consumer
(cd /path/to/consumer && node .core-services/debug-source/src/validate-repo.mjs)
node scripts/repository-validation/repository-validator.mjs remove-debug-source /path/to/consumer
```

`.core-services/debug-source/` is local, disposable, gitignored debugging material. It is not
consumer-owned production code. Fixes discovered there belong in `core-services-ai-tooling`; rebuild
the central bundle, run its regression suite, and update the consumer kit from the corrected source.
