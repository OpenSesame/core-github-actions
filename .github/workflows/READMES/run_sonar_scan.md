# Run SonarQube Scan

This reusable workflow checks out the ref that triggered the caller, or a specified commit or ref, and runs a SonarQube scan with full Git history.

## Prerequisites

The consuming repository must include its SonarQube configuration, such as a `sonar-project.properties` file, or otherwise provide configuration supported by the scan action.

## Usage

```yaml
jobs:
  sonar-scan:
    uses: OpenSesame/core-github-actions/.github/workflows/run_sonar_scan.yml@workflows/run_sonar_scan/1.0.0
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

To scan a different commit, tag, or branch, pass `commit-identifier`:

```yaml
with:
  commit-identifier: ${{ github.sha }}
```

## Inputs

| Input               | Type   | Required | Default               | Description                                       |
| ------------------- | ------ | -------- | --------------------- | ------------------------------------------------- |
| `commit-identifier` | string | No       | Triggering ref or SHA | Commit SHA, tag, or branch to check out and scan. |

## Secrets

| Secret        | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `SONAR_TOKEN` | Yes      | Token used to authenticate the SonarQube scan. |

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [SonarQube scan action](https://github.com/SonarSource/sonarqube-scan-action)
