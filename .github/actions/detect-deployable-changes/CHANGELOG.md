# Detect Deployable Changes Changelog

All notable changes to the `detect-deployable-changes` action are documented in this file.

## 1.0.0

### Added

- A `pull-request` mode that skips a pull request's deploy when only ignorable files changed since
  its newest commit whose run passed `proof-job`, or when the whole pull request changes only
  ignorable files and none of its commits were deployed.
- A `merge` mode that skips a merged pull request's deploy when only ignorable files changed since
  the base branch's newest merge whose run passed `proof-job`.
- Ignorable paths from `ignore-paths-file` and `ignore-paths`, overridden by `deploy-paths`, as
  root-anchored globs with `*`, `**` and `?`. The ignore file itself always deploys.
- Waiting for unfinished earlier runs for up to `wait-timeout-minutes`, polling every
  `poll-interval-seconds`, and searching at most `max-commits` earlier commits.
- `should-deploy`, `reason` and `verified-sha` outputs, and a step summary listing the deployable
  files.
- Deploying on any doubt: other events, re-runs, reopened pull requests, pull request actions other
  than `opened` and `synchronize`, force-pushes, empty pushes, failed, cancelled or unfinished
  earlier runs, shallow checkouts, bad inputs and any error.
