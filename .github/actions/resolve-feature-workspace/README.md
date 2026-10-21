# Resolve Feature Workspace

## Summary

Derives a feature environment's Terraform workspace name and resource name prefix from a branch name. Use the same action in deploy and cleanup workflows so both always select the same workspace. It only computes names; it does not run Terraform.

## Inputs

| Name          | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `branch-name` | Yes      | Branch name, or an environment name such as `dev`, to resolve. |

## Outputs

| Name          | Description                                     |
| ------------- | ----------------------------------------------- |
| `workspace`   | Terraform workspace name.                       |
| `name-prefix` | `workspace` lowercased, for AWS resource names. |

## Naming rule

1. Keep the text after the last `/`.
2. Replace `_` with `-`.
3. Keep the first 15 characters.
4. Trim trailing `-`.

| `branch-name`                       | `workspace`       | `name-prefix`     |
| ----------------------------------- | ----------------- | ----------------- |
| `feature/CORE-6135`                 | `CORE-6135`       | `core-6135`       |
| `feature/my_fix`                    | `my-fix`          | `my-fix`          |
| `feature/CORE-6135_add_widget_flow` | `CORE-6135-add-w` | `core-6135-add-w` |
| `feature/CORE-6135-abcd-xyz`        | `CORE-6135-abcd`  | `core-6135-abcd`  |
| `dev`                               | `dev`             | `dev`             |

The result matches the `awk | tr | cut | sed` pipeline and the local `get-feature-workspace-name` actions already used in consumer repos, so open feature environments keep their workspace when a repo migrates. The action fails when the result is empty (for example `feature/` or `feature/---`) or when `branch-name` contains control characters.

## Usage

```yaml
- name: Resolve feature workspace
  id: workspace
  # Replace with the immutable commit SHA for actions/resolve-feature-workspace/1.0.0.
  uses: OpenSesame/core-github-actions/.github/actions/resolve-feature-workspace@<immutable-commit-sha>
  with:
    branch-name: ${{ github.head_ref }}

- name: Select Terraform workspace
  working-directory: terraform/dev
  env:
    TF_WORKSPACE_NAME: ${{ steps.workspace.outputs.workspace }}
  run: terraform workspace select -or-create "$TF_WORKSPACE_NAME"
```

This action does not require additional GitHub token permissions.
