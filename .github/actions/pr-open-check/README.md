# PR Open Check Action — Find Open PR for Branch

## 🧭 Summary

Finds an open pull request associated with a given commit, typically the one triggering a workflow.
Used to determine whether a PR exists and to provide its number and URL for usage in later steps (e.g., posting summaries or comments).

- Outputs are written to $GITHUB_OUTPUT so they can be consumed by subsequent steps.
- Returns pr_exists=false when no open PR includes the given commit.
- When `head-ref` is set, only returns an open PR opened from that branch of the current repository.

This allows conditional steps later in the workflow to skip PR updates cleanly.

## Scope/Limitations

This action detects open pull requests **only for commits within the same repository**.  
It does not detect PRs originating from forks. With `head-ref` set, a fork PR whose branch has the same
name is never matched.

Without `head-ref`, the action returns the first open PR associated with the commit, whatever its head
branch. If two branches point at the same commit and only one has an open PR, a push to the other branch
still reports that PR. Pass `head-ref: ${{ github.ref_name }}` when you use `pr_exists` to decide whether
a push run is covered by a PR run.

The action reads one page of up to 100 PRs associated with the commit. If more than 100 PRs contain the
commit, a matching PR beyond the first 100 is not found.

## 🔒 Permissions

The following GHA permissions are required to use this step

```yaml
permissions:
  contents: read
  pull-requests: read
```

## Dependencies

- **`curl`** - Used to query the GitHub API for pull requests associated with the commit.
- **`jq`** - Used to parse the JSON API response.

> Both tools are preinstalled on GitHub-hosted Ubuntu runners.  
> If running in a container or on a self-hosted runner, they must be installed manually.

## ⚙️ Inputs

| Name                | Required | Description                                                            |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `github-token`      | ✅       | GitHub token with `repo` read access (`secrets.GITHUB_TOKEN` is fine). |
| `commit-identifier` | ✅       | If you don't allow specifying other commits, pass in (`github.sha`).   |
| `head-ref`          |          | Branch the PR must be opened from, usually `github.ref_name`.          |

### `head-ref` matching rules

When `head-ref` is set, a PR is returned only if all of the following hold:

- its `state` is `open`
- its `head.ref` equals `head-ref`
- its `head.repo.full_name` equals `GITHUB_REPOSITORY` (PRs from forks, including deleted forks, never
  match)

When `head-ref` is empty or omitted, the first open PR associated with the commit is returned, as in
2.0.0.

## 📤 Outputs

| Name        | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `pr_exists` | `"true"` or `"false"` — whether a PR is open including the commit. |
| `pr_number` | The PR number, if one exists.                                      |
| `pr_url`    | The PR’s web URL, if one exists.                                   |

## 🚀 Usage

```yaml
- name: Check for open PR
  id: pr_check
  uses: OpenSesame/core-github-actions/.github/actions/pr-open-check@actions/pr-open-check/2.1.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    commit-identifier: ${{ github.sha }}
```

Only match a PR opened from the pushed branch:

```yaml
- name: Check for open PR
  id: pr_check
  uses: OpenSesame/core-github-actions/.github/actions/pr-open-check@actions/pr-open-check/2.1.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    commit-identifier: ${{ github.sha }}
    head-ref: ${{ github.ref_name }}
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

- Uses the GitHub API via `curl`, internally the step runs the following commands to detect an open pull request including the commit.
- It does rely on the `groot-preview`

```bash
api_url="https://api.github.com/repos/$OWNER/$REPO/commits/$COMMIT/pulls"
pr_json=$(curl -sSL -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github.groot-preview+json" "$api_url" || true)
open_pr='[.[] | select(.state == "open") | select($head_ref == "" or (.head.ref == $head_ref and .head.repo.full_name == $repo))][0]'
pr_number=$(jq -r --arg head_ref "$HEAD_REF" --arg repo "$REPO_FULL" "$open_pr.number // empty" <<<"$pr_json")
```

- If the API response is not a JSON array (for example a rate-limit error, an HTML error page, or an
  empty body), the step emits a `::warning::` and returns `pr_exists=false` instead of failing.
