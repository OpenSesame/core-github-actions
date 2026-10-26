# Run npm Publish Workflow Changelog

All notable changes to the **run_npm_publish** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release of the `run_npm_publish` reusable workflow.
- Job `version` ("Version"), with `contents: read` only, works out the version from the release
  markers in commit messages with github-tag-action as a dry run.
- Job `publish` ("Publish") runs only when there is a version to publish. It sets the version in
  `package.json`, runs `build-command`, publishes `publish-directory` to GitHub Packages, and only
  then creates the version tag. Its checkout keeps no credentials; the token reaches only `npm ci`,
  `npm publish` and the `gh` calls.
- `prerelease: false` publishes with the `latest` dist-tag and creates the tag and GitHub release
  together with `gh release create`. `prerelease: true` publishes with the `experimental` dist-tag
  and creates a bare beta tag.
- Inputs `prerelease` (default `false`), `initial-version` (default `1.0.0`), `build-command`
  (default empty), `publish-directory` (default `.`) and `node-version-file` (default `.nvmrc`).
- Output `version`, empty when nothing was published.
- Reruns: a rerun after a failed publish works out the same version again, and a rerun after a failed
  tag or release step skips `npm publish` when the registry's `gitHead` for that version is this
  commit. Creating a tag or release that already exists on the same commit succeeds.
- A version already published from another commit gets its missing tag on that commit, and the job
  fails with a message to rerun, which picks the next version. Only a 404 from the registry counts as
  not published; any other lookup error fails the job.
- Refuses to publish when `<publish-directory>/package.json` does not carry the new version.
- Job summaries: the version bump, version and dist-tag from `version`, and the result and step
  outcomes from `publish`.
