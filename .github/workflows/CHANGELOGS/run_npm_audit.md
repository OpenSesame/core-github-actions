# Run npm Audit Workflow Changelog

All notable changes to the **run_npm_audit** reusable workflow are documented in this file.

## 1.0.0

### Added

- First release of the `run_npm_audit` reusable workflow.
- One job, `audit` ("Audit"), that runs `npm audit --omit=dev --audit-level=<audit-level>` in each
  directory listed in `working-directories` and fails if any directory has a production advisory at or
  above `audit-level`, has no `package-lock.json`, or returns an audit error.
- Inputs `commit-identifier`, `working-directories` (default `.`), `audit-level` (default `high`) and
  `node-version-file` (default `.nvmrc`).
- Job summary table of advisory counts per directory, plus the failing advisories for each failed
  directory.
- Audits from the lockfile without `npm ci`, so no registry token is required.
