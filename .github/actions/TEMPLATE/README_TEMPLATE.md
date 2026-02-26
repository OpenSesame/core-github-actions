# {action-name} Action

## 🧭 Summary

<!-- Brief description of what this action does -->

## Scope/Limitations

<!-- Describe supported scenarios and known constraints -->

## 🔒 Permissions

<!-- Adjust for the permissions necessary for the action -->

The following GHA permissions are required to use this step:

```yaml
permissions:
  contents: read
```

## Dependencies

<!-- List required tools, CLIs, or environment expectations -->

<!-- Example:
- `gh` — GitHub CLI
- `jq` — JSON processor

> Both tools are preinstalled on GitHub-hosted Ubuntu runners.
> If running in a container or on a self-hosted runner, they must be installed manually.
-->

## ⚙️ Inputs

| Name         | Required | Description |
| ------------ | -------- | ----------- |
| `input-name` | ✅/❌    |             |
| `input-name` | ✅/❌    |             |

## 📤 Outputs

| Name          | Description |
| ------------- | ----------- |
| `output-name` |             |
| `output-name` |             |

## 🚀 Usage

Basic usage example:

```yaml
- name: Name for step
  id: <step-id>
  uses: OpenSesame/core-github-actions/.github/actions/<action-name>@actions/<action-name>/vX.Y.Z
  with:
    <input-name>: <value>
```

Example outputs:

```yaml
steps.<step-id>.outputs.<output-name>
```

Example usage of outputs in later steps:

```yaml
if: steps.<step-id>.outputs.<output-name> == '<expected-value>'
run: echo "Condition met"
```

## 🧠 Notes

<!-- Add internal details, design considerations, or behavior caveats -->

## Versioning

This action uses namespaced tags for versioning and is tracked in the CHANGELOG.

```text
action/<action-name>/vX.Y.Z
```

See the repository's versioning documentation for details on how tags are validated and created.
