# Run SonarQube Scan

This reusable workflow checks out the ref that triggered the caller, or a specified commit or ref, and runs a SonarQube scan with full Git history. Callers can optionally download a coverage artifact produced earlier in the same workflow run before the scan starts.

## Prerequisites

The consuming repository must include its SonarQube configuration, such as a `sonar-project.properties` file, or otherwise provide configuration supported by the scan action.

## Usage

```yaml
jobs:
  sonar-scan:
    uses: OpenSesame/core-github-actions/.github/workflows/run_sonar_scan.yml@workflows/run_sonar_scan/1.3.0
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

To scan a different commit, tag, or branch, pass `commit-identifier`:

```yaml
with:
  commit-identifier: ${{ github.sha }}
```

To import coverage produced by another job, upload the report as an artifact and make the Sonar job depend on the test job:

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-26.04
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm test -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: unit-test-coverage
          path: coverage/lcov.info
          if-no-files-found: error

  sonar-scan:
    needs: unit-tests
    uses: OpenSesame/core-github-actions/.github/workflows/run_sonar_scan.yml@<released-sha>
    with:
      coverage-artifact-name: unit-test-coverage
      coverage-artifact-path: .coverage
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

This downloads the report to `.coverage/lcov.info`. Configure SonarQube to read that location, for example with `sonar.javascript.lcov.reportPaths=.coverage/lcov.info`. The workflow does not run tests or generate coverage. If `coverage-artifact-name` is set but the artifact does not exist, the download step fails the job.

## Inputs

| Input                    | Type   | Required | Default               | Description                                                                 |
| ------------------------ | ------ | -------- | --------------------- | --------------------------------------------------------------------------- |
| `commit-identifier`      | string | No       | Triggering ref or SHA | Commit SHA, tag, or branch to check out and scan.                           |
| `coverage-artifact-name` | string | No       | `''`                  | Name of a coverage artifact uploaded earlier in the same workflow run.      |
| `coverage-artifact-path` | string | No       | `.`                   | Directory into which the coverage artifact is downloaded before the scan.  |

## Secrets

| Secret        | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `SONAR_TOKEN` | Yes      | Token used to authenticate the SonarQube scan. |

The workflow job runs on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [SonarQube scan action](https://github.com/SonarSource/sonarqube-scan-action)
