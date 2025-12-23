# GitHub Workflows Directory

This directory contains externally reusable and internal, project-specific GitHub Actions workflows for this repository.

## Internal Workflows

Internal workflows are used by this repository for the pipeline of its products. They must never expose `workflow_call` and must be  prefixed with `internal_`

## Reusable Workflows

This repository exposes externally reusable workflows, those that expose `workflow_call`. These workflows are treated as **products** of this repo.

### Requirements

- Only `.yml` files are considered valid workflow definitions.
- Workflow, changelog, and README file names must match the workflow name (excluding the `.yml` extension).
- CHANGELOGs and READMEs must be kept up to date with any changes to the workflow.

- **Workflow YAML files:**
  - Workflow definitions must be placed directly in this directory.
  - Their filenames should describe what they do, e.g. `deploy_environment.yml`, `tf_apply.yml`.
  - File name: `{workflow_name}.yml`
  - Example: `run_semgrep_scan.yml`

- **Changelog files:**
  - Each workflow must have a corresponding changelog documenting all notable changes.
  - Path: `CHANGELOGS/{workflow_name}.md`
  - Example: `CHANGELOGS/run_semgrep_scan.md`

- **README files:**
  - Each workflow should have a README describing its purpose, usage, inputs, and outputs.
  - Path: `READMEs/{workflow_name}.md`
  - Example: `READMEs/run_semgrep_scan.md`

### Example Structure

```text
.github/workflows/
  run_semgrep_scan.yml
  CHANGELOGS/
    run_semgrep_scan.md
  READMEs/
    run_semgrep_scan.md
```
