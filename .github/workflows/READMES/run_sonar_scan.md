# Run SonarQube Scan

This reusable workflow checks out the ref that triggered the caller, or a specified commit or ref,
downloads the coverage artifacts produced earlier in the same workflow run, and runs a SonarQube scan
with full Git history. Runs triggered by `dependabot[bot]` or `renovate[bot]` skip the scan.

## Prerequisites

The consuming repository must include its SonarQube configuration, such as a `sonar-project.properties`
file, or otherwise provide configuration supported by the scan action.

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

Upload each package's lcov report as an artifact named `coverage-<package>`, including in
single-package repositories:

```yaml
- name: Upload coverage
  uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
  with:
    name: coverage-user-management-api
    path: lambdas/user-management-api/coverage/lcov.info
    if-no-files-found: error
```

The workflow downloads every artifact whose name matches `coverage-artifact-pattern` (default
`coverage-*`) into `coverage-artifact-path` (default `.sonar-coverage`):

- When two or more artifacts match, each is downloaded into its own directory:
  `.sonar-coverage/coverage-<package>/lcov.info`.
- When exactly one artifact matches, `actions/download-artifact` places its files directly in the path:
  `.sonar-coverage/lcov.info`.
- When no artifact matches, the download succeeds with nothing downloaded. The job emits a warning and a
  job summary line, and the scan runs without coverage.

Point SonarQube at every layout with one wildcard, the same value in every repository:

```properties
sonar.javascript.lcov.reportPaths=.sonar-coverage/**/lcov.info
```

SonarJS resolves this property with `WildcardPattern`, where `**/` matches zero or more directories, so
the pattern covers both the single-artifact and multi-artifact layouts. SonarJS also matches each
lcov `SF:` path to a project file by path suffix, so a report generated inside
`lambdas/<package>` with paths like `SF:src/handler.ts` maps to `lambdas/<package>/src/handler.ts`.

Set `coverage-artifact-pattern: ''` to skip the coverage download entirely. The workflow does not run
tests or generate coverage.

## Inputs

| Input                       | Type   | Required | Default               | Description                                                                            |
| --------------------------- | ------ | -------- | --------------------- | -------------------------------------------------------------------------------------- |
| `commit-identifier`         | string | No       | Triggering ref or SHA | Commit SHA, tag, or branch to check out and scan.                                      |
| `coverage-artifact-pattern` | string | No       | `coverage-*`          | Glob of same-run artifact names to download before the scan. Empty skips the download. |
| `coverage-artifact-path`    | string | No       | `.sonar-coverage`     | Directory into which matching coverage artifacts are downloaded.                       |

## Secrets

| Secret        | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `SONAR_TOKEN` | Yes      | Token used to authenticate the SonarQube scan. |

## Permissions

| Permission | Reason                              |
| ---------- | ----------------------------------- |
| `contents` | `read`: check out the code to scan. |

Downloading artifacts from the same workflow run needs no extra permission.

The workflow job runs on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [SonarQube scan action](https://github.com/SonarSource/sonarqube-scan-action)
- [actions/download-artifact](https://github.com/actions/download-artifact)
