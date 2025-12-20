# GitHub Action Workflows

## Naming Convention

- **Reusable workflows** (those that expose `workflow_call`) are treated as **products** of this repo.  
  Their filenames should describe what they do, e.g. `deploy_environment.yml`, `tf_apply.yml`.

- **Internal workflows** (used only by this repository and never exposed via `workflow_call`)  
  must be prefixed with: `internal_`
