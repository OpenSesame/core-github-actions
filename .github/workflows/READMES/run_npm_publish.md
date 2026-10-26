# Run npm Publish

This reusable workflow publishes an npm package to GitHub Packages, with the version set by the
release markers in commit messages. Call it with `prerelease: false` on pushes to `main` to publish
`latest` and create a GitHub release, and with `prerelease: true` on pushes to other branches to
publish a beta with the `experimental` dist-tag.

The workflow has two jobs:

1. `version` ("Version") works out the version with
   [github-tag-action](https://github.com/anothrNick/github-tag-action) as a dry run. It reads every
   commit message since the highest `x.y.z` tag and applies the largest marker it finds: `#major`,
   then `#minor`, then `#patch`. `#none`, or no marker, publishes nothing. Markers are matched as
   lowercase text anywhere in the message. This job can only read the repository.
2. `publish` ("Publish") runs only when there is a version to publish. It installs dependencies with
   `npm ci --ignore-scripts`, sets the version in `package.json` without committing it, runs
   `build-command`, and publishes `publish-directory`. Only after the publish succeeds does it create
   the version tag: with `gh release create`, which creates the tag and the release together, for
   `latest`, or as a bare tag for a beta.

Because the tag comes last, a failed publish leaves no tag behind, and rerunning the workflow works
out the same version and publishes it. A rerun after a failed tag or release step finds the version
already published from the same commit, through the `gitHead` npm records, skips `npm publish` and
creates the tag. Creating a tag or release that already exists on the same commit succeeds.

If the version was already published from another commit, by a run whose tag step failed or by a run
on another branch that picked the same beta version, `publish` creates that version's tag on the
commit that published it, if it is missing, and fails with a message to rerun. The rerun picks the
next version. Only a 404 from the registry counts as "not published"; any other lookup error fails the
job before it publishes.

Betas still get a tag because github-tag-action numbers the next beta from the highest existing
beta tag, for example `1.4.0-beta.2` after `1.4.0-beta.1`.

## Prerequisites

- `package.json` publishes to GitHub Packages, for example with
  `"publishConfig": { "registry": "https://npm.pkg.github.com/opensesame" }`.
- Release tags are plain `x.y.z`, with no `v` prefix.
- The file named by `node-version-file` exists (`.nvmrc` by default).
- When `publish-directory` is not `.`, `build-command` copies `package.json` into it. The version is
  set before `build-command` runs, and the workflow refuses to publish a `package.json` that carries
  another version.

## Usage

Publish `latest` from `main`:

```yaml
name: Publish Latest

on:
  push:
    branches:
      - main

concurrency:
  group: release_latest
  cancel-in-progress: false

permissions: {}

jobs:
  publish:
    name: Publish Latest
    uses: OpenSesame/core-github-actions/.github/workflows/run_npm_publish.yml@<released-sha> # workflows/run_npm_publish/1.0.0
    permissions:
      contents: write # Required to create the GitHub release and its version tag.
      packages: write # Required to publish the package to GitHub Packages.
    with:
      build-command: |
        npm run build
        npm test
```

Publish betas from every other branch:

```yaml
name: Publish Beta

on:
  push:
    branches-ignore:
      - main

concurrency:
  group: beta_publish_${{ github.ref }}
  cancel-in-progress: false

permissions: {}

jobs:
  publish:
    name: Publish Beta
    uses: OpenSesame/core-github-actions/.github/workflows/run_npm_publish.yml@<released-sha> # workflows/run_npm_publish/1.0.0
    permissions:
      contents: write # Required to create the beta version tag.
      packages: write # Required to publish the beta package to GitHub Packages.
    with:
      prerelease: true
      build-command: npm run build
```

The checks are reported as `Publish Latest / Version` and `Publish Latest / Publish`, or
`Publish Beta / Version` and `Publish Beta / Publish`. `Publish` shows as skipped when nothing is
published.

Keep one concurrency group for `latest` so releases from `main` run one at a time. Keep the beta
group per branch: GitHub keeps only one pending run per group, so a shared group would let a push on
one branch cancel another branch's queued beta. When two branches pick the same beta version, the
second run tags the first one's commit and fails with a message to rerun, and the rerun picks the
next version.

For a package published from a build directory:

```yaml
with:
  build-command: npm run build # copies package.json into dist/
  publish-directory: ./dist
```

## Inputs

| Input               | Type    | Required | Default  | Description                                                                                                                                          |
| ------------------- | ------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prerelease`        | boolean | No       | `false`  | `true` publishes a beta with the `experimental` dist-tag and a beta tag; `false` publishes `latest` and a GitHub release.                            |
| `initial-version`   | string  | No       | `1.0.0`  | Version to bump from when the repository has no `x.y.z` tag yet.                                                                                     |
| `build-command`     | string  | No       | `''`     | Bash commands run after the version is set and before publishing, such as the build and tests. Run with `-eo pipefail`; a failure stops the publish. |
| `publish-directory` | string  | No       | `.`      | Directory to publish, relative to the repository root. Its `package.json` must carry the new version.                                                |
| `node-version-file` | string  | No       | `.nvmrc` | File that sets the Node.js version.                                                                                                                  |

`build-command` runs without a registry token. It runs only when a version will be published.

## Outputs

| Output    | Description                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `version` | Version this run published, or found already published from this commit. Empty when nothing was published. |

## Failure conditions

`version` fails only when github-tag-action does. `publish` fails when any of these is true:

- `npm ci`, `npm version` or `build-command` fails.
- `<publish-directory>/package.json` does not carry the new version.
- The registry lookup fails with anything other than a 404.
- The version is already published from another commit. `publish` tags that commit first; rerun the
  workflow to publish this commit as the next version.
- The version is already published but the registry records no commit for it. Create the version's
  tag on the commit that published it, then rerun.
- `npm publish`, `gh release create` or the beta tag request fails, or the tag already points to
  another commit. Rerun the workflow; it skips the publish if it already succeeded.

## Permissions

The caller grants:

| Permission | Reason                                                                |
| ---------- | --------------------------------------------------------------------- |
| `contents` | `write`: create the version tag, and the GitHub release for `latest`. |
| `packages` | `write`: publish the package to GitHub Packages.                      |

`version` narrows these to `contents: read`. Its checkout keeps the token because github-tag-action
runs `git fetch --tags`, and that token can only read. `publish` has the write permissions, so its
checkout keeps no credentials. Its token is passed only to the steps that need it: `npm ci`,
`npm publish` and the `gh` calls. `build-command` and npm lifecycle scripts get no token.

`setup-node` dependency caching is disabled, so a cache written by another workflow can't change what
is published.

Both jobs run on Ubuntu 26.04.

## Contribution

- Update the workflow, README, changelog, and unit tests in `TESTS/run_npm_publish.unit.test.js`
  together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [github-tag-action](https://github.com/anothrNick/github-tag-action)
- [npm publish](https://docs.npmjs.com/cli/commands/npm-publish)
- [Working with the npm registry in GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
