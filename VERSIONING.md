# Versioning Policy

This repository contains **reusable GitHub Actions and reusable workflows** that may be consumed by multiple repos or teams. To ensure safe updates and backward compatibility, all versioned components follow the standards defined below.

## Scope

**Current**

- Composite Actions that live under `./github/actions`

**Future**

- Reusable workflows that live under `./github/workflows`

**Excluded**

- Composite Actions that live in the root of this repository.

## 🧭 Overview

Each versioned component must:

1. Maintain its own `CHANGELOG.md`
2. Use namespaced semantic version tags
3. Declare version information in PR labels
4. Pass automated version + changelog validation before merge
5. Get tags created automatically after merge

## 📌 Namespaced Tags

Versioned components use namespaced semantic version tags so multiple components can be versioned independently within this repository.

**Format**

```text
action/<component-name>/vX.Y.Z
```

**Examples**

```text
action/pr-open-check/v1.0.0
action/pr-upsert-comment/v0.2.3
```

**Semantic Versioning**

Version numbers follow SemVer:

- MAJOR — breaking changes to the action
- MINOR — new features in a backward-compatible way
- PATCH — backwards-compatible fixes and internal improvements

The version declared in a PR label must match both:

- the semantic meaning of the change, and
- an entry in the component’s CHANGELOG.md.

## 🏷️ PR Label Requirements

### Component Versioning

PRs that modify a versioned component must include a label per component modified.

**Format**

`version:<component-name>:vX.Y.Z`

- `<component-name>` is the folder name under `./github`
- `X.Y.Z` is the semantic version being released for that component

**Example**

```text
version:actions/pr-open-check:v1.1.0
```

Multiple version labels are allowed on a PR.

### Special Case: Untracked Versions

Use an untracked version label only when a PR modifies files outside of any versioned component, or modifies a component in a way that does not change its behavior (e.g., documentation-only changes, tests, comments).

**Format**

```text
version:untracked
```

Rules for untracked:

- Should be used sparingly and only when behavior, inputs, or outputs do not change
- Must be the only version label on the PR
- PR is allowed to merge
- No tag is created
- No changelog entry is required

### Validation Rules

A PR will fail automated validation if any of the following are true:

- The PR does not have a version label
- There are multiple version labels and one of them is version:untracked
- A version label uses an invalid component name
- X.Y.Z version does not appear in the component’s CHANGELOG.md
- There are duplicate or malformed version labels

A PR cannot merge until version validation passes.

## 📝 CHANGELOG Requirements

Each versioned component must have its own changelog. The changelog is the authoritative source of truth for released versions of that component.

**Located At**

```text
.github/actions/<component-name>/CHANGELOG.md
```

**Examples**

```text
.github/actions/pr-open-check/CHANGELOG.md
```

### Required Format

Each released version must have a heading that includes the version label

```md
## X.Y.Z

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...
```

Minimum requirements:

- The header must contain `## X.Y.Z` exactly (this is what validation looks for).
- The PR must add or update an entry for the version used in the label
(version:<component-name>:vX.Y.Z).

The rest of the content (sections and bullets) is for humans, but strongly recommended.

### Interaction with Labels

For versioned releases, A label like `version:actions/pr-open-check:v1.2.0`
requires that CHANGELOG.md under `.github/actions/pr-open-check/` contain a `## 1.2.0` entry.

Validation will fail if:

- A vX.Y.Z label is present but `## X.Y.Z` does not appear in the matching component’s CHANGELOG.md.
