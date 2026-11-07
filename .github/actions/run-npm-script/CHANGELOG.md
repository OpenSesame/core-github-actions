# run-npm-script action Changelog

All notable changes to the **run-npm-script** action are documented in this file.

## 1.0.0

### Added

- Run the `script` input with `npm run` in the working directory.
- Fail with a `Missing package.json` error when there is no `package.json`, and a `Missing npm script` error when `package.json` has no such script. Both name the `technology` input.
