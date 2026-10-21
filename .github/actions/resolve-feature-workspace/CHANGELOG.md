# Resolve Feature Workspace Changelog

All notable changes to the `resolve-feature-workspace` composite action are documented in this file.

## 1.0.0

### Added

- Resolve the feature-environment Terraform workspace name from a branch name: last `/` segment, `_` replaced with `-`, first 15 characters, trailing `-` trimmed.
- Expose the lowercased workspace as the `name-prefix` output.
- Fail when the resolved name is empty or the branch name contains control characters.
