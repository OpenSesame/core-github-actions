# Run JS Checks Workflow Changelog

All notable changes to the **run_js_checks** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input.
- One job, `checks` ("Checks"), that runs the `lint:js`, `format:prettier` package.json scripts with `npm run`. Each step runs after earlier failures once `npm ci` succeeded, and a
  missing script fails its own step.
- An optional `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN` secret, so `npm ci` can install private `@opensesame`
  packages from GitHub Packages.
- Outputs `lint`, `format` and `baselined` (inline `eslint-disable` and `prettier-ignore` comments).
