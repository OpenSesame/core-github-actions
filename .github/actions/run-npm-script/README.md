# Run npm Script Action

## 🧭 Summary

Runs one `package.json` script with `npm run`. When the script or `package.json` is missing, the step fails with an error that names the technology, so a repository that contains, say, Terraform but has no `lint:terraform` script gets a clear message instead of npm's `Missing script`.

The Repo Checks workflows (`run_*_checks`) use it for every lint, format and scan step.

## Scope/Limitations

- Runs in the job's working directory, after the caller has checked out the code and installed dependencies.
- Doesn't install anything, and passes no extra arguments to the script.
- Exits with the script's exit code.

## 🔒 Permissions

The action needs no GitHub token permissions. The caller needs whatever it uses to check out the code:

```yaml
permissions:
  contents: read
```

## Dependencies

- `npm`, set up by the caller, for example with `actions/setup-node`
- `jq`, preinstalled on GitHub-hosted Ubuntu runners

## ⚙️ Inputs

| Name         | Required | Description                                                 |
| ------------ | -------- | ----------------------------------------------------------- |
| `script`     | ✅       | The `package.json` script to run, for example `lint:shell`  |
| `technology` | ✅       | The technology the script checks, used in the missing error |

## 📤 Outputs

This action does not set any outputs. Use the step's `outcome`.

## 🚀 Usage

```yaml
- name: Install dependencies
  id: install
  run: npm ci --ignore-scripts

- name: Lint
  id: lint
  if: ${{ !cancelled() && steps.install.outcome == 'success' }}
  uses: OpenSesame/core-github-actions/.github/actions/run-npm-script@<sha> # actions/run-npm-script/1.0.0
  with:
    script: lint:terraform
    technology: Terraform
```

Replace `<sha>` with the full commit SHA of the tag: `git rev-list -n1 actions/run-npm-script/1.0.0`.

## Versioning

This action follows the repository's component versioning policy. The initial release uses the PR label `v:a/run-npm-script/1.0.0` and the namespaced tag `actions/run-npm-script/1.0.0`.
