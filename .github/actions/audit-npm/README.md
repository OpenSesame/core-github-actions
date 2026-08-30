# NPM Audit Action

## 🧭 Summary

Runs `npm audit`, parses the results, and outputs a markdown summary and a pass/fail gate for use in CI workflows. Designed for Node.js projects to automate dependency vulnerability checks.

## Scope/Limitations

- Only supports projects with a `package.json` in the working directory.
- Requires `jq` (preinstalled on GitHub-hosted runners).
- Only checks for vulnerabilities reported by `npm audit`.

## 🔒 Permissions

The following GHA permissions are required to use this step:

```yaml
permissions:
  contents: read
```

## Dependencies

- `jq` — JSON processor (preinstalled on GitHub-hosted Ubuntu runners)
- `npm` — Node.js package manager

## 📤 Outputs

| Name           | Description                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `gate_passed`  | true/false if audit gate passed (no critical or high vulnerabilities in production dependencies) |
| `gate_summary` | Markdown summary of audit results                                                                |

## 🚀 Usage

Basic usage example:

```yaml
- name: Audit NPM dependencies
  id: audit
  uses: ./.github/actions/audit-npm
  continue-on-error: true
```

Example outputs:

```yaml
steps.audit.outputs.gate_passed
steps.audit.outputs.gate_summary
```

Example usage of outputs in later steps:

```yaml
- name: Show audit summary
  run: echo "${{ steps.audit.outputs.gate_summary }}"

- name: Check audit gate
  if: steps.audit.outputs.gate_passed == 'false'
  run: |
    echo "Audit gate failed"
    exit 1
```

## 🧠 Notes

- The audit gate only checks production dependencies for critical or high vulnerabilities.
- The summary table includes both production and all dependencies.
- This action does not auto-fix vulnerabilities; it only reports them.

## Versioning

This action uses namespaced tags for versioning and is tracked in the CHANGELOG.

```text
action/audit-npm/vX.Y.Z
```

See the repository's versioning documentation for details on how tags are validated and created.
