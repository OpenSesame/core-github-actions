# Run npm Publish Workflow Changelog

All notable changes to the **run_npm_publish** reusable workflow are documented in this file.

## 1.1.1

### Fixed

- A repository with no `x.y.z` tag publishes: markers in its whole history bump `initial-version`.
  Before, github-tag-action read no history without such a tag, so nothing was published and
  `initial-version` never applied.
- A run that uses `initial-version` fails unless it is `x.y.z`.

## 1.1.0

### Added

- A caller triggered by a merged pull request publishes and tags its merge commit. On that event
  `github.sha` is the base branch's head, which can be a later commit.

## 1.0.0

### Added

- First release. Publishes to GitHub Packages with the version from commit release markers: `latest`
  with a GitHub release, or a beta with the `experimental` dist-tag and a beta tag.
- Creates the tag only after the publish, so failed runs can be rerun.
- Inputs `prerelease`, `initial-version`, `build-command`, `publish-directory` and
  `node-version-file`; output `version`.
