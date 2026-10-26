# Run npm Publish Workflow Changelog

All notable changes to the **run_npm_publish** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release of the `run_npm_publish` reusable workflow.
- One job, `publish` ("Publish"), that works out the version from the release markers in commit
  messages with github-tag-action as a dry run, sets it in `package.json`, runs `build-command`,
  publishes `publish-directory` to GitHub Packages, and only then creates the version tag.
- `prerelease: false` publishes with the `latest` dist-tag and creates the tag and GitHub release
  together with `gh release create`. `prerelease: true` publishes with the `experimental` dist-tag
  and creates a bare beta tag.
- Inputs `prerelease` (default `false`), `initial-version` (default `1.0.0`), `build-command`
  (default empty), `publish-directory` (default `.`) and `node-version-file` (default `.nvmrc`).
- Output `version`, empty when nothing was published.
- Reruns: a rerun after a failed publish works out the same version again, and a rerun after a failed
  tag or release step skips `npm publish` when the registry's `gitHead` for that version is this
  commit. A version already published from another commit fails with a message to rerun.
- Refuses to publish when `<publish-directory>/package.json` does not carry the new version.
- Skips Node setup, install and build when nothing is to be published.
- Job summary with the version bump, version, dist-tag and step outcomes.
