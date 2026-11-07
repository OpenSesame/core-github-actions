# Run Repo Checks Workflow Changelog

All notable changes to the **run_repo_checks** reusable workflow are documented in this file.

## 1.0.1

### Changed

- Calls the 1.0.1 per-technology workflows and `run_repo_validation` 1.0.1 from the same commit,
  which bump `jdx/mise-action` to 5.2.5 and `actions/setup-node` to 7.1.0.
- Its `run_repo_validation` 1.0.1 also pins GitHub's SSH host keys for the latest-release lookup.

## 1.0.0

### Added

- First release, extracted from the Repo Checks trial in identity-infrastructure-template
  (`on_call_repo_checks.yml`), with an optional `commit-identifier` input, an optional
  `ORG_READ_ONLY_SSH_KEY` secret for Standard, and an optional `ORG_GITHUB_PACKAGES_READ_ONLY_TOKEN`
  secret for the Markdown and JS checks.
- `detect` ("Detect") counts GitHub Actions, Terraform, Markdown, Shell and JavaScript/TypeScript
  files among tracked files, ignoring `.core-services/` and generated or vendored directories, and
  counting `sh`, `bash` and `zsh` shebangs as shell.
- `gha`, `terraform`, `markdown`, `shell` and `js` call `run_gha_checks`, `run_terraform_checks`,
  `run_markdown_checks`, `run_shell_checks` and `run_js_checks` 1.0.0 from the same commit, each
  skipped when Detect finds none of its files.
- `standard` ("Standard") calls `run_repo_validation` 1.0.0 from the same commit with only the `ORG_READ_ONLY_SSH_KEY`
  secret.
- `summary` ("Summary") writes a table of files, init, validate, lint, format and scan results, and baselined counts
  per technology, plus the Standard result, even after failures.
