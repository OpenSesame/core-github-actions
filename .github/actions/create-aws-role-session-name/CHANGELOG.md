# Create AWS Role Session Name Changelog

All notable changes to the `create-aws-role-session-name` composite action are documented in this file.

## 1.0.0

### Added

- Build role session names from the operation, environment, run ID, and actor.
- Replace AWS-incompatible bytes and truncate output to the 64-character limit.
- Expose the sanitized role session name as the `name` output.
