### Overview

The build composite action generates and builds the code.

The action will do the following:

1. Run npm commands generate and build

### Requirements

The following items must be in the repository:

* `package.json` dependencies:
  * `env-cmd` - to launch process using environment variables in `.env` file
  * `core-build-library` - for core-build commands
* `package.json` scripts:
  * `build` - build the code
* (optional) `secrets-map.json` file containing map of secrets and associated environment variables. These will be written to `.env` file.
