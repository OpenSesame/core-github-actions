### Overview

The cleanup composite action destroys terraform resources in a target environment

The action will do the following:

1. Configure githug credentials so that terraform can read from our private repos
2. Run `npm install`
3. Run a script to read secrets and write them to a `.env` file (git ignored)
4. Run terraform commands using the `.env` file to destroy state in the target environment under the provided workspace

### Requirements

The following items must be in the repository:

* `package.json` dependencies:
  * `env-cmd` - to launch process using environment variables in `.env` file
  * `core-build-library` - for core-build commands
* `package.json` scripts:
  * `lint` - lint the code
  * `build` - build the code
  * `test` - test the code (pre-deployment)
* `secrets-map.json` file containing map of secrets and associated environment variables. These will be written to `.env` file.
* `terraform` folder containing roots for each environment (`dev`, `stage`, and `prod`)
