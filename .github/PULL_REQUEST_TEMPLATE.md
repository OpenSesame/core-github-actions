# PR Summary

Jira: <https://opensesame.atlassian.net/browse/CORE-XXXX>

## Description of Changes

<!-- Describe the changes you made andy why -->

## Versioning

⚠️ Components in this repo are used by multiple repos and teams. Breaking changes to non-versioned components are high-risk. Always apply correct versioning to versioned components to ensure safe, controlled updates.

Versioned components live under `./github/actions`

Does this PR modify a versioned component?

- [ ] **No** — label this PR with `version:untracked`
- [ ] **Yes**
  - Add a version label: `version:<component-name>:vX.Y.Z`
  - Ensure the component’s `CHANGELOG.md` includes a `## vX.Y.Z` entry
  - Use `version:untracked` **only** if changes do _not_ alter behavior, inputs, or outputs

**If version labels are incorrect or missing, automated version validation will fail and block merge.**

## Dependencies of PR

<!-- Please list any dependencies this pull request has -->

## Testing

<!-- Please describe any testing you ran manually -->
