### Overview

The cleanup composite action validates terraform changes against a target environment

The action will do the following:

1. Configure githug credentials so that terraform can read from our private repos
2. Run `npm install`
3. Run a script to read secrets and write them to a `.env` file (git ignored)
4. Run terraform commands using the `.env` file to validate changes against the target environment under the provided workspace.

### Requirements

The following items must be in the repository:

* `scripts/tf-select-workspace.js` - script to select a terraform workspace based on a branch name (or from a given branch)
* `scripts/read-secrets.js` - script to read secrets from AWS using the `secrets-map.json` and output an `.env` file
* `secrets-map.json` containing map of secrets and associated environment variables. These will be written to `.env` file.
* npm dependencies
  * `env-cmd` - to launch process using environment variables in `.env` file
  * `current-git-branch` - used by the tf-select-workspace script to read the current git branch
* `terraform` folder containing roots for each environment (`dev`, `stage`, and `prod`)
