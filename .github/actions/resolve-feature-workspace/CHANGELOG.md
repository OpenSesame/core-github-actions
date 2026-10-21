# Resolve Feature Workspace Changelog

All notable changes to the `resolve-feature-workspace` composite action are documented in this file.

## 1.0.0

### Added

- Resolve the feature-environment Terraform workspace name from a branch name: last `/` segment, lowercased, characters other than `a-z`, `0-9` and `-` replaced with `-`, repeated `-` collapsed, leading `-` trimmed, first 15 characters, trailing `-` trimmed.
- Fail when the resolved name is empty or the branch name contains control characters.
