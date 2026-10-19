# Run SonarQube Scan

Runs a SonarQube scan with full Git history, importing coverage artifacts from the same workflow run.
Skips runs by `dependabot[bot]` and `renovate[bot]`. Requires the repo's `sonar-project.properties`.

## Usage

```yaml
jobs:
  sonar:
    name: Sonar
    needs: [ci-context, app-ci]
    if: ${{ !cancelled() && needs.ci-context.outputs.should-run-ci == 'true' }}
    uses: OpenSesame/core-github-actions/.github/workflows/run_sonar_scan.yml@<released-sha> # workflows/run_sonar_scan/2.0.0
    permissions:
      contents: read # Required to check out the code to scan.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

The check is reported as `Sonar / Scan`.

## Coverage

1. Upload each package's lcov report as an artifact named `coverage-<package>`:

   ```yaml
   - name: Upload coverage
     uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
     with:
       name: coverage-user-management-api
       path: lambdas/user-management-api/coverage/lcov.info
       if-no-files-found: error
   ```

2. If Jest runs outside the repo root, make lcov paths repo-relative so Sonar maps coverage to the
   right files:

   ```js
   // lambdas/user-management-api/jest.config.js
   module.exports = {
     coverageReporters: [
       ['lcov', { projectRoot: require('node:path').resolve(__dirname, '../..') }],
       'text',
     ],
   };
   ```

3. Set the same report path in every repo:

   ```properties
   sonar.javascript.lcov.reportPaths=.sonar-coverage/**/lcov.info
   ```

If no `lcov.info` is downloaded, the job warns and scans without coverage.

## Inputs

| Input                       | Default               | Description                                                              |
| --------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `commit-identifier`         | Triggering ref or SHA | Commit SHA, tag, or branch to scan.                                      |
| `coverage-artifact-pattern` | `coverage-*`          | Same-run artifact names to download. Empty skips coverage.               |
| `coverage-artifact-path`    | `.sonar-coverage`     | Download directory. Must not already exist with content in the checkout. |

Secret `SONAR_TOKEN` is required.

## Contribution

Update the workflow, README, and changelog together, and set a version label per
[VERSIONING.md](../../../VERSIONING.md).
