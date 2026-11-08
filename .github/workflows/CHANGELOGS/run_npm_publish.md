# Run npm Publish Workflow Changelog

All notable changes to the **run_npm_publish** reusable workflow are documented in this file.

## 1.1.3

### Changed

- Works out the next version in its own step instead of `anothrNick/github-tag-action`, which has had
  no release since August 2025. The workflow's inputs and outputs are unchanged.
- The `Version` job's checkout keeps no credentials; it no longer runs `git fetch --tags`.

### Fixed

- A beta numbers after the highest beta of the version it publishes. Before, once a repository had an
  `x.y.z` tag, only the highest beta tag of any version counted, so a beta could reuse a taken number.
- A commit that already has a beta tag of the version publishes nothing, with or without an `x.y.z`
  tag. Before, a repository with no `x.y.z` tag published another beta.

## 1.1.2

### Changed

- Bumped `actions/setup-node` from 7.0.0 to 7.1.0, pinned by commit SHA.

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
