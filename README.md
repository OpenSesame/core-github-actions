# Core Github Actions

The Core Services team uses GitHub Actions to standardize our CI/CD process.

## ❌ Deprecation Notice: Legacy Composite Actions

An earlier version of the 'Core' team wrote root-level composite actions in this repository to provide a standardized way for teams to build, test, and deploy software.
These actions have not been actively maintained in years and are considered deprecated by the current Core Services team.

- [build](./build)
- [build-apply](./build-apply)
- [build-publish](./build-publish)
- [cleanup](./cleanup)
- [deploy](./deploy)
- [select-branch-workspace](./select-branch-workspace/)
- [semgrep](./semgrep/)
- [tf-apply](./tf-apply)
- [tf-plan](./tf-plan/)
- [tf-plan-comment](./tf-plan-comment/)

### Why deprecated

1. They hide important pipeline details making it difficult for engineers to understand or troubleshoot CI/CD pipelines.
2. They have accumulated technical debt and do not reflect our current best practices.

### What we're doing instead

The Core Services team uses reusable workflows for shared CI/CD orchestration so standard pipeline phases remain visible. Narrowly scoped utility composite actions are also acceptable when they live under `.github/actions`, have a cohesive contract, and follow this repository's component versioning policy.

### Maintenance ownership of the old composite actions

- Use of these composite actions is **at your own risk**.
- The Core Services team will not maintain them.
- If your team still relies on them, we are happy to make you `CODEOWNER` for the relevant directories.

### Migration options

- Copy the composite action code directly into your workflow in place of calling the composite action.
- Use a reusable workflow for multi-phase CI/CD orchestration.
- Use a versioned utility composite action under `.github/actions` when the behavior is cohesive and does not hide standard pipeline phases.

## ⚠️ Versioning Warning

Versioned components have namespaced release tags and changelogs. Unversioned workflows and legacy
actions still affect all consumers immediately, so make changes carefully and aim for passivity.

## Testing

To test changes before merging into main:

1. Create a feature branch and make your changes.
2. Push the branch to GitHub.
3. Update a consuming repo’s workflow to reference your branch and push to GitHub.
   For example, if you are working on branch `feature/CORE-123`:

   ```yaml
   uses: opensesame/core-github-actions/build-apply@feature/CORE-123
   ```

The same approach can be used for referencing feature branch versions of the reusable workflows.

## 🚀 New Additions

### Local Development Setup

There are recommended vscode extensions and settings included in the project.

To get started:

- install semgrep globally `brew install semgrep`
- install [mise](https://mise.jdx.dev/) (`brew install mise`), then run `mise install` for actionlint,
  shellcheck and zizmor, pinned in `mise.toml`. `npm run lint:gha` and `npm run scan:gha` run them, and
  `npm run check` includes both.
- use Node.js 24.15.0 or newer in the Node.js 24 release line, with the npm it ships (11.10.0 or
  newer) (`nvm use`)
- install project dependencies `npm ci`

### 🏷️ Versioning Policy Overview

A complete policy is defined in [VERSIONING.md](VERSIONING.md). Highlights:

- Versioned actions use `actions/{component-name}/vX.Y.Z` tags
- Versioned workflows use `workflows/{component-name}/X.Y.Z` tags
- PRs modifying a component must include a version label
- `v:untracked` is allowed for non-behavior changes
- Version/changelog validation runs automatically on PRs
- Tags are automatically created when changes merge into main

### Reusable Workflows

Reusable workflows cover repository checks and validation, publishing, Terraform planning and
deployment, and other shared CI/CD orchestration. Each versioned workflow has a contract in
`.github/workflows/READMES` and release history in `.github/workflows/CHANGELOGS`.

Cross-repository callers should pin an immutable commit SHA, not a mutable branch or tag. Resolve the
SHA for a workflow release with:

```sh
git rev-list -n1 workflows/<component-name>/<version>
```

For example, `run_repo_checks` detects and runs the applicable GitHub Actions, Terraform, Markdown,
shell, and JavaScript or TypeScript checks. See its
[workflow documentation](.github/workflows/READMES/run_repo_checks.md) for the required repository
tasks and scripts.

### 🧩 Versioned Composite Actions

New composite actions live under:

```text
.github/actions/<component-name>/
```

Each action:

- Has its own README.md
- Maintains a component-level CHANGELOG.md
- Must follow the repository-wide versioning rules in VERSIONING.md
- Requires version labels on PRs (e.g., `v:a/pr-open-check/1.0.0`)

Versioning ensures that consumers can safely upgrade without unexpected breaking changes.
