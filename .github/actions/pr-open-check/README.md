# PR Open Check Action — Find Open PR for Branch

## 🧭 Summary

Finds an open pull request associated with a given branch, typically the one triggering a workflow.
Used to determine whether a PR exists and to provide its number and URL for usage in later steps (e.g., posting summaries or comments).

- Outputs are written to $GITHUB_OUTPUT so they can be consumed by subsequent steps.
- Returns pr_exists=false when no open PR matches the given branch.

This allows conditional steps later in the workflow to skip PR updates cleanly.

## Scope/Limitations

This action detects open pull requests **only for branches within the same repository**.  
It does not detect PRs originating from forks.

## 🔒 Permissions

The following GHA permissions are required to use this step

```yaml
permissions:
  contents: read
  pull-requests: read
```

## Dependencies

- **GitHub CLI (`gh`)** - Used to query open pull requests. Must be available on the runner.
- **`jq`** - Used to parse JSON output from `gh`.

> Both tools are preinstalled on GitHub-hosted Ubuntu runners.  
> If running in a container or on a self-hosted runner, they must be installed manually.

## ⚙️ Inputs

| Name           | Required | Description                                                               |
| -------------- | -------- | ------------------------------------------------------------------------- |
| `github-token` | ✅       | GitHub token with `repo` read access (`secrets.GITHUB_TOKEN` is fine).    |
| `branch`       | ❌       | Branch name to check. Defaults to the current branch (`github.ref_name`). |

## 📤 Outputs

| Name        | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| `pr_exists` | `"true"` or `"false"` — whether a PR is open for this branch. |
| `pr_number` | The PR number, if one exists.                                 |
| `pr_url`    | The PR’s web URL, if one exists.                              |

## 🚀 Usage

```yaml
- name: Check for open PR
  id: pr_check
  uses: ./.github/actions/pr-check-open
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Example outputs available to later steps:

```yaml
steps.pr_check.outputs.pr_exists   # true | false
steps.pr_check.outputs.pr_number   # e.g., 123
steps.pr_check.outputs.pr_url      # https://github.com/org/repo/pull/123
```

Example usage in later steps:

```yaml
if: steps.pr_check.outputs.pr_exists == 'true'
run: echo "Found PR #${{ steps.pr_check.outputs.pr_number }}"
```

## 🧠 Notes

- Using the GitHub CLI (`gh`), internally the step runs the following command to detect an open pull request by head branch name.

```bash
gh pr list --state open --head <branch> --json number,url
```
