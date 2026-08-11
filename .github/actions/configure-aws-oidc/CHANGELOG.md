# Configure AWS OIDC Changelog

All notable changes to the `configure-aws-oidc` composite action are documented in this file.

## 1.0.0

### Added

- Create and sanitize an AWS role session name.
- Resolve the AWS role ARN and region through `OpenSesame/gha-oidc-access`.
- Configure temporary AWS credentials for subsequent steps in the calling job.
- Expose the resolved role ARN, region, and role session name for observability.
