# Configure AWS OIDC Changelog

All notable changes to the `configure-aws-oidc` composite action are documented in this file.

## 1.0.1

### Changed

- Pinned all internal `uses:` steps to commit SHAs with a version comment for auditability (CORE-5974).
- Bumped `aws-actions/configure-aws-credentials` from `v6.2.3` to `v6.2.4`.
- `OpenSesame/gha-oidc-access/get-role-arn` remains pinned to the same commit it already used (which is ahead of that repo's stale `v2` tag) — see PR notes.

## 1.0.0

### Added

- Create and sanitize an AWS role session name.
- Resolve the AWS role ARN and region through `OpenSesame/gha-oidc-access`.
- Configure temporary AWS credentials for subsequent steps in the calling job.
- Expose the resolved role ARN, region, and role session name for observability.
