# Run GHA Checks Workflow Changelog

All notable changes to the **run_gha_checks** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input.
- One job, `checks` ("Checks"), that runs the `lint:gha`, `scan:gha` package.json scripts with `npm run`. Each step runs after earlier failures once `npm ci` succeeded, and a
  missing script fails its own step.
- Outputs `lint`, `scan` and `baselined` (inline `# zizmor: ignore[...]` comments under `.github`).
