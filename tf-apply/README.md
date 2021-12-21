### Overview

The tf-apply-management composite action initializes, validates and apply terraform resources whilst selecting the desired workspace.

The action will do the following:

1. Configure github credentials so that terraform can read from our private repos
2. Run a script to read secrets and write them to a `.env` file (git ignored)
3. Run terraform commands uses the `.env` file to validate and apply state to the target environment under the provided workspace

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
