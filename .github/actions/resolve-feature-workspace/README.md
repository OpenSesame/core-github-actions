# Resolve Feature Workspace

## Summary

Derives a feature environment's lowercase Terraform workspace name from a branch name. Use the same action in deploy and cleanup workflows so both always select the same workspace. It only computes names; it does not run Terraform.

## Inputs

| Name          | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `branch-name` | Yes      | Branch name, or an environment name such as `dev`, to resolve. |

## Outputs

| Name        | Description                         |
| ----------- | ----------------------------------- |
| `workspace` | Lowercase Terraform workspace name. |

## Naming rule

1. Keep the text after the last `/`.
2. Replace `_` with `-`.
3. Lowercase.
4. Keep the first 15 characters.
5. Trim trailing `-`.

| `branch-name`                       | `workspace`       |
| ----------------------------------- | ----------------- |
| `feature/CORE-6135`                 | `core-6135`       |
| `feature/my_fix`                    | `my-fix`          |
| `feature/CORE-6135_add_widget_flow` | `core-6135-add-w` |
| `feature/CORE-6135-abcd-xyz`        | `core-6135-abcd`  |
| `dev`                               | `dev`             |

Other characters pass through unchanged: `feature/a+b` gives `a+b`. Check AWS naming rules before using the workspace in resource names such as S3 buckets. The action fails when the result is empty (for example `feature/` or `feature/---`) or when `branch-name` contains control characters.

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

The result equals the lowercase name prefix that consumer repos already compute with the copied `awk | tr | cut | sed` pipeline, but the workspace itself is now lowercase too. Workspace names are case-sensitive, so a branch such as `feature/CORE-6135` moves from workspace `CORE-6135` to `core-6135`. Migrate deploy and cleanup together, and only when no feature environment with uppercase letters in its workspace name is open; otherwise cleanup can't find the old workspace and its resources are orphaned.

This action does not require additional GitHub token permissions.
