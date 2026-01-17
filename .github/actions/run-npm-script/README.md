# Run NPM Script Action

## 🧭 Summary

Runs a specified npm script (e.g., build, lint:check, test) if present in package.json, and outputs the result as success, failure, or notpresent. Useful for DRY, reusable npm script checks in CI workflows.

## Scope/Limitations

- Only works with projects that have a package.json in the specified working directory.
- Requires jq (preinstalled on GitHub-hosted runners).
- Only checks for the existence of the script key, not its content.

## 🔒 Permissions

The following GHA permissions are required to use this step:

```yaml
permissions:
  contents: read
```

## Dependencies

- `jq` — JSON processor (preinstalled on GitHub-hosted Ubuntu runners)
- `npm` — Node.js package manager

## ⚙️ Inputs

| Name                | Required | Description                                                                      |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `script`            | ✅       | The npm script to run (e.g., build, lint:check, test)                            |
| `working-directory` | ❌       | Directory containing package.json, pass in '.' if you want the current directory |

## 📤 Outputs

| Name     | Description                     |
| -------- | ------------------------------- |
| `status` | success, failure, or notpresent |

## 🚀 Usage

Basic usage example:

```yaml
- name: Run build script
  id: build
  uses: ./.github/actions/run-npm-script
  with:
    working-directory: '.'
    script: build
```

Example outputs:

```yaml
steps.build.outputs.status
```

Example usage of outputs in later steps:

```yaml
if: steps.build.outputs.status == 'success'
run: echo "Build passed!"
```

## 🧠 Notes

- The action will output notpresent if the script is not found in package.json or if package.json is missing.
- The action will output failure if the script exists but fails.
- The action will output success if the script runs and exits with code 0.

## Versioning

This action uses namespaced tags for versioning and is tracked in the CHANGELOG.

```text
action/run-npm-script/vX.Y.Z
```

See the repository's versioning documentation for details on how tags are validated and created.
