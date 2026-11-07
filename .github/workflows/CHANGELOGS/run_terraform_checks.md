# Run Terraform Checks Workflow Changelog

All notable changes to the **run_terraform_checks** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input.
- One job, `checks` ("Checks"), that runs the `lint:terraform`, `format:terraform`, `scan:terraform` package.json scripts with `npm run`. Each step runs after earlier failures once `npm ci` succeeded.
- A `Check npm scripts` step that writes a `Missing npm script` error, naming the technology, for each
  of those scripts `package.json` lacks.
- Outputs `lint`, `format`, `scan` and `baselined` (findings in tracked `*.checkov.baseline` files, plus inline `#checkov:skip=` and `# tflint-ignore:` comments in `*.tf` files).
