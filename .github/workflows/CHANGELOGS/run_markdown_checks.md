# Run Markdown Checks Workflow Changelog

All notable changes to the **run_markdown_checks** reusable workflow are documented in this file.

## 1.0.2

### Fixed

- Installs the npm version from `package.json`'s `packageManager` (`npm@X.Y.Z`) before `npm ci`, and
  keeps the npm that ships with `.nvmrc`'s Node when there is none. `npm ci` failed with EBADENGINE in
  repositories whose `engines.npm` needs a newer npm than Node bundles and that set `engine-strict`.
- The `baselined` output counts only real inline directives (`<!-- markdownlint-disable…` in `*.md`
  files), and counts each one rather than each line. Names in documentation, changelogs and test
  fixtures inflated the count.

## 1.0.1

### Changed

- Bumped `actions/setup-node` from 7.0.0 to 7.1.0, pinned by commit SHA.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input.
- One job, `checks` ("Checks"), that runs the `lint:markdown` package.json script with `npm run`. Each step runs after earlier failures once `npm ci` succeeded, and a
  missing script fails its own step.
- An optional `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` secret, so `npm ci` can install private `@opensesame`
  packages from GitHub Packages.
- Outputs `lint` and `baselined` (inline `markdownlint-disable` comments in `*.md` files).
