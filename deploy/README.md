### Overview

The deploy composite action runs npm commands to deploy to a target environment, followed by post-deployment contract tests.

The action will do the following:

1. Run npm command `deploy` if present, piping from terraform output
2. Run npm command `contract-tests` if present, piping from terraform output

### Requirements

The following items must be in the repository:

* `package.json` dependencies:
  * `env-cmd` - to launch process using environment variables in `.env` file
  * `core-build-library` - for core-build commands
* `package.json` scripts:
  * `lint` - lint the code
  * `build` - build the code
  * `test` - test the code (pre-deployment)
* `terraform` folder containing roots for each environment (`dev`, `stage`, and `prod`)
* (optional) `secrets-map.json` file containing map of secrets and associated environment variables. These will be written to `.env` file.
