# Run npm Publish

Publishes an npm package to GitHub Packages, versioned by release markers in commit messages. The
largest of `#major`, `#minor` and `#patch` since the highest `x.y.z` tag wins; `#none`, or no
marker, publishes nothing.

- `prerelease: false`, for pushes to `main`: publishes `latest` and creates a GitHub release.
- `prerelease: true`, for other branches: publishes a beta with the `experimental` dist-tag and
  creates a beta tag.

The tag is created only after the publish succeeds, so a failed run can be rerun.

## Usage

```yaml
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

For betas, trigger on `branches-ignore: [main]`, use `group: beta_publish_${{ github.ref }}`, and
set `prerelease: true`. Keep the beta group per branch; a shared group lets one branch's push cancel
another branch's queued beta.

## Inputs

| Input               | Default  | Description                                                                                       |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `prerelease`        | `false`  | Publish a beta instead of `latest`.                                                               |
| `initial-version`   | `1.0.0`  | Version to bump from when there is no `x.y.z` tag yet.                                            |
| `build-command`     | `''`     | Bash run after the version is set, before publishing. A failure stops the publish. Gets no token. |
| `publish-directory` | `.`      | Directory to publish. Its `package.json` must carry the new version.                              |
| `node-version-file` | `.nvmrc` | File that sets the Node.js version.                                                               |

Output `version` is the published version, empty when nothing was published.

## Reruns

- Failed before the publish finished: rerun to publish the same version.
- Failed after the publish: rerun to skip the publish and create the tag.
- "Already published from another commit": that commit's tag was missing, and this run created it.
  Rerun to publish this commit as the next version.

## Permissions

The caller grants `contents: write` and `packages: write`. The `Version` job only reads. The
`Publish` job's checkout keeps no credentials, and only `npm ci`, `npm publish` and the `gh` calls
get the token. Both npm commands run with `--ignore-scripts`, so package scripts such as
`prepublishOnly` don't run; put the build in `build-command`.

## Contribution

Update the workflow, this README, the changelog and `TESTS/run_npm_publish.unit.test.js` together,
and label the PR following [VERSIONING.md](../../../VERSIONING.md).
