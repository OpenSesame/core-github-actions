# Run npm Audit

This reusable workflow audits production npm dependencies and fails when any audited lockfile has an
advisory at or above `audit-level` (High by default). It runs
`npm audit --omit=dev --audit-level=<level>` in each directory listed in `working-directories` and
writes a job summary table with one row per directory. Directories that fail also get a table of the
advisories that caused the failure.

The audit reads `package-lock.json` directly, so the workflow does not run `npm ci` and needs no
registry token. Private `@opensesame` packages resolved from GitHub Packages are listed in the lockfile
but have no public advisories, and the audit request goes only to the public npm registry.

## Prerequisites

- Each directory in `working-directories` contains a committed `package-lock.json`.
- The file named by `node-version-file` exists (`.nvmrc` by default).

## Usage

```yaml
jobs:
  dependency-audit:
    name: Dependency Audit
    uses: OpenSesame/core-github-actions/.github/workflows/run_npm_audit.yml@<released-sha> # workflows/run_npm_audit/1.0.0
    permissions:
      contents: read # Required to check out the lockfiles to audit.
    with:
      commit-identifier: ${{ needs.ci-context.outputs.commit-identifier }}
```

The check is reported as `Dependency Audit / Audit`.

For a repository with more than one lockfile, list each directory on its own line:

```yaml
with:
  working-directories: |
    .
    lambdas/user-management-api
    lambdas/token-service
```

Blank lines and surrounding whitespace are ignored. Every listed directory is audited even when an
earlier one fails, and the job fails if any directory fails.

## Inputs

| Input                 | Type   | Required | Default               | Description                                                                              |
| --------------------- | ------ | -------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `commit-identifier`   | string | No       | Triggering ref or SHA | Commit SHA, tag, or branch to check out and audit.                                       |
| `working-directories` | string | No       | `.`                   | Newline-separated directories, relative to the repository root, each with a lockfile.    |
| `audit-level`         | string | No       | `high`                | Lowest advisory severity that fails the audit: `low`, `moderate`, `high`, or `critical`. |
| `node-version-file`   | string | No       | `.nvmrc`              | File that sets the Node.js version used to run npm.                                      |

## Failure conditions

The job fails when any of these is true:

- A directory has a production advisory at or above `audit-level`.
- A directory has no `package-lock.json`.
- `npm audit` returns an error, for example when the npm registry is unreachable.
- `audit-level` is not one of the allowed values, or `working-directories` lists no directories.

## Permissions

| Permission | Reason                           |
| ---------- | -------------------------------- |
| `contents` | `read`: check out the lockfiles. |

The workflow job runs on Ubuntu 26.04.

## Contribution

- Update the workflow, README, and changelog together.
- Create a PR and set a version label following the [versioning instructions](../../../VERSIONING.md).

## References

- [npm audit](https://docs.npmjs.com/cli/commands/npm-audit)
