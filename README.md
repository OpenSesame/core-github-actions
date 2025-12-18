# Core Github Actions

The Core Services team uses GitHub Actions to standardize our CI/CD process.

## ❌ Deprecation Notice: Composite Actions

An earlier version of the 'Core' team wrote composite actions in this repository to provide a standardized way for teams to build, test, and deploy software.
These actions have not been actively maintained in years and are considered deprecated by the current Core Services team.

* [build](./build)
* [build-apply](./build-apply)
* [build-publish](./build-publish)
* [cleanup](./cleanup)
* [deploy](./deploy)
* [select-branch-workspace](./select-branch-workspace/)
* [semgrep](./semgrep/)
* [tf-apply](./tf-apply)
* [tf-plan](./tf-plan/)
* [tf-plan-comment](./tf-plan-comment/)

### Why deprecated

 1. They hide important pipeline details making it difficult for engineers to understand or troubleshoot CI/CD pipelines.
 2. They have accumulated technical debt and do not reflect our current best practices.

### What we're doing instead

The Core Services team is writing a standard set of reusable workflows defined in this same repository for use by our repos. This approach improves visibility, reduces hidden complexity, and ensures pipelines follow current standards.  

### Maintenance ownership of the old composite actions

* Use of these composite actions is **at your own risk**.  
* The Core Services team will not maintain them.  
* If your team still relies on them, we are happy to make you `CODEOWNER` for the relevant directories.  

### Migration options
  
* Copy the composite action code directly into your workflow in place of calling the composite action.
* Consider writing your own reusable GHA or discuss with us ways to make ours more widely adoptable and maintainable.

## ⚠️ Versioning Warning

Unless noted otherwise, Nothing in this repo is currently versioned. Changes here affect **all consumers immediately**. Make changes carefully and aim for passivity to avoid breaking existing workflows.

## Testing

To test changes before merging into main:

1. Create a feature branch and make your changes.
2. Push the branch to GitHub.
3. Update a consuming repo’s workflow to reference your branch and push to GitHub.
   For example, if you are working on branch `feature/CORE-123`:

    ```yaml
    uses: opensesame/core-github-actions/build-apply@feature/CORE-123
    ```

The same approach can be used for referencing feature branch versions of the reusable workflows.

## 🚀 New Additions

### 🚧 Reusable Workflows (Work in Progress)

The Core Services team is moving away from composite actions and building **reusable workflows** in this repository.

### Current scope

At this stage, the reusable workflows support **Terraform-only projects**. They are still evolving and are not yet versioned. While they can be consumed by other repositories, their API is not considered stable. Their contracts remain subject to change until the versioning model expands to reusable workflows.

### 🧩 Versioned Composite Actions

New composite actions live under:

```text
.github/actions/<component-name>/
```

Each action:

* Has its own README.md
* Maintains a component-level CHANGELOG.md
* Must follow the repository-wide versioning rules in VERSIONING.md
* Requires version labels on PRs (e.g., version:pr-open-check:v1.0.0)

Versioning ensures that consumers can safely upgrade without unexpected breaking changes.

🏷️ Versioning Policy Overview

* A complete policy is defined in VERSIONING.md. Highlights:
* Versioned components use namespaced tags: actions/<component-name>/vX.Y.Z
* PRs modifying a component must include a version label
* version:untracked is allowed for non-behavior changes
* Version/changelog validation runs automatically on PRs
* Tags are automatically created when changes merge into main