# upsert-pr-comment action Changelog

All notable changes to the **upsert-pr-comment** action are documented in this file.

## 1.0.0

### Added

- Initial release of the reusable composite action for upserting PR comments.
- Supports creating or updating a PR comment based on a unique hidden marker.
- Accepts the following required inputs:
  - `github-token`: GitHub token with repo scope
  - `pr-number`: Pull Request number
  - `comment-marker`: Unique marker to identify the comment
  - `body-content`: Markdown content for the comment body
- Uses `actions/github-script@v7` to interact with the GitHub REST API.
- Automatically updates an existing comment if the marker is found, or creates a new comment if not.
- No external dependencies required beyond GitHub Actions standard runners.
