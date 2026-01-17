# audit-npm action Changelog

All notable changes to the **audit-npm** action are documented in this file.

## v1.0.0

### Added

- Initial release of audit-npm composite action
- Runs `npm audit`
- Parses and summarizes vulnerabilities by severity
- Outputs a markdown summary and a boolean audit gate
- Audit gate fails if a critical or high production vulnerability exists
