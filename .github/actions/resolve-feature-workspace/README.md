# Resolve Feature Workspace

## Summary

Derives a feature environment's Terraform workspace name from a branch name. The name uses only `a-z`, `0-9` and single hyphens. Use the same action in deploy and cleanup workflows so both always select the same workspace. It only computes names; it does not run Terraform.

## Inputs

| Name          | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `branch-name` | Yes      | Branch name, or an environment name such as `dev`, to resolve. |

## Outputs

| Name        | Description                                   |
| ----------- | --------------------------------------------- |
| `workspace` | Terraform workspace name (`a-z`, `0-9`, `-`). |

## Naming rule

1. Keep the text after the last `/`.
2. Lowercase.
3. Replace each character other than `a-z`, `0-9` and `-` with `-` (including `_`, `.`, `+` and `[]`), then collapse repeated `-`.
4. Trim a leading `-`, keep the first 15 characters, then trim a trailing `-`.

| `branch-name`                       | `workspace`       |
| ----------------------------------- | ----------------- |
| `feature/CORE-6135`                 | `core-6135`       |
| `feature/my_fix`                    | `my-fix`          |
| `feature/CORE-6135_add_widget_flow` | `core-6135-add-w` |
| `feature/CORE-6135-abcd-xyz`        | `core-6135-abcd`  |
| `release/2026.10.21`                | `2026-10-21`      |
| `dev`                               | `dev`             |

The output starts and ends with a letter or digit. The action fails when the result is empty (for example `feature/` or `feature/---`) or when `branch-name` contains control characters.

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

`github.head_ref` is set only for `pull_request` events. Pass `github.ref_name` on `push` and `github.event.ref` on `delete` (when `github.event.ref_type` is `branch`).

## Migrating

Workspace names are case-sensitive, and this rule differs from the copied `awk | tr | cut | sed` pipeline: `feature/CORE-6135` moves from workspace `CORE-6135` to `core-6135`. Migrate deploy and cleanup together. Before migrating, compare each open feature environment's workspace with this action's output; if any differ, close those environments first, or cleanup can't find the old workspace and its resources are orphaned.

This action does not require additional GitHub token permissions.
