# Upsert PR Comment Action

## 🧭 Summary

Creates or updates a comment on a GitHub Pull Request. The comments are identified by a unique hidden marker. This ensures only one comment per marker is present, updating the comment if one already exists for the marker or creating a new one if not.

## Scope/Limitations

- Supports upserting comments on an open PR in any repository where the action is used.
- Only works for PRs (not issues or other event types).
- Requires a GitHub token with appropriate permissions.
- The marker must be unique per comment type to avoid accidental overwrites.

## 🔒 Permissions

The following GitHub Actions permissions are required:

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Dependencies

- Uses `actions/github-script@v7`
- Uses the GitHub REST API
- Runs on any GitHub-hosted runner

## ⚙️ Inputs

| Name             | Required | Description                                                      |
| ---------------- | -------- | ---------------------------------------------------------------- |
| `github-token`   | ✅       | GitHub token with repo scope (use `${{ secrets.GITHUB_TOKEN }}`) |
| `pr-number`      | ✅       | Pull Request number                                              |
| `comment-marker` | ✅       | Unique marker to identify the comment (hidden in HTML comment)   |
| `body-content`   | ✅       | Markdown content for the comment body                            |

## 📤 Outputs

This action does not set any outputs.

## 🚀 Usage

Basic usage example:

```yaml
- name: Upsert PR summary comment
  uses: ./.github/actions/upsert-pr-comment
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pr-number: ${{ github.event.pull_request.number }}
    comment-marker: 'my-unique-marker'
    body-content: |
      ## PR Scan Results
      - All checks passed!
```

## 🧠 Notes

- The comment marker is embedded as an HTML comment and should be unique for each comment type you want to upsert.
- If multiple workflows use the same marker, they will overwrite each other's comments.
- The action uses the GitHub REST API to list, update, or create comments.

## Versioning

This action uses namespaced tags for versioning and is tracked in the repository CHANGELOG.
