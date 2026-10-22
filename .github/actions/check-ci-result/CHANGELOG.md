# Check CI Result Changelog

All notable changes to the `check-ci-result` composite action are documented in this file.

## 1.0.0

### Added

- Summarize each needed job's result in the step summary from the `needs-json` input.
- Pass when every result is `success` or `skipped`; fail with one `::error` line listing each job whose result is `failure` or `cancelled`.
- Fail with an `Invalid needs-json` error when `needs-json` is empty, not a single JSON value, an empty or non-object value, or has an entry without a valid job ID and a known result.
