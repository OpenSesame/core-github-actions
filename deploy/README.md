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
  * (optional) `env:deploy` - generate your deploy environment
  * (optional) `contract-tests` - test the code (post-deployment)
* `terraform` folder containing roots for each environment (`dev`, `stage`, and `prod`)

