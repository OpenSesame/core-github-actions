# Run npm Publish Workflow Changelog

All notable changes to the **run_npm_publish** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release. Publishes to GitHub Packages with the version from commit release markers: `latest`
  with a GitHub release, or a beta with the `experimental` dist-tag and a beta tag.
- Creates the tag only after the publish, so failed runs can be rerun.
- Inputs `prerelease`, `initial-version`, `build-command`, `publish-directory` and
  `node-version-file`; output `version`.
