# Run Repo Validation Workflow Changelog

All notable changes to the **run_repo_validation** reusable workflow are documented in this file.

## 1.0.1

### Changed

- Bumped `actions/setup-node` from 7.0.0 to 7.1.0, pinned by commit SHA.
- The latest-release lookup pins GitHub's published host keys (from `api.github.com/meta`) for its
  `git ls-remote` over SSH, instead of trusting the runner image's `known_hosts`.

## 1.0.0

### Added

- First release, replacing the inline `repo-validation` job of repository standard 0.13.2, with an
  optional `commit-identifier` input and an optional `ORG_READ_ONLY_SSH_KEY` secret.
- One job, `validate` ("Validate"), that runs `.core-services/generated/validate-repo.mjs` and
  reports its outcome as the `result` output.
- The latest-release lookup runs `git ls-remote` with `BatchMode=yes` and a 30-second timeout, warns
  instead of failing when it can't reach the repository, and is skipped with a notice without the
  secret.
- A missing validator kit fails with a clear error.
