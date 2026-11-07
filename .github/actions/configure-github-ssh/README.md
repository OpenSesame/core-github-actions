# Configure GitHub SSH Action

## 🧭 Summary

Installs an SSH private key and GitHub's published host keys, so `git` and Terraform can fetch private github.com repositories over SSH, for example Terraform modules sourced from `git@github.com:OpenSesame/...`.

It replaces the inline step that wrote the key and ran `ssh-keyscan github.com`. That step trusted whatever host answered at run time, so a spoofed github.com could serve code to a job holding the org's read-only key.

- Writes the key to `~/.ssh/github_read_only_key` and GitHub's host keys to `~/.ssh/github_known_hosts`, under `umask 077`, so each file is readable only by the runner user.
- Writes `~/.ssh/config` with one `Host github.com` block that uses only that key and requires the pinned host keys (`StrictHostKeyChecking yes`, `GlobalKnownHostsFile /dev/null`).
- Fails with an `Existing SSH config` error, before writing anything, when `~/.ssh/config` already exists with other content. Merging can't isolate github.com: an existing `IdentityFile` would still be offered to GitHub, and global settings would end up scoped to github.com. Running the action twice in a job is fine, because its own config is accepted.
- Fails with a `Missing SSH key` error when `ssh-private-key` is empty, for example when the caller didn't pass the secret.

## Scope/Limitations

- Run it before any other SSH setup in the job, on a runner without an SSH config, such as a GitHub-hosted runner.
- Applies only to `github.com`. Other SSH hosts keep the runner's defaults.
- The host keys are the ones GitHub publishes at `https://api.github.com/meta` (`ssh_keys`), matching the fingerprints in GitHub's documentation. If GitHub rotates a key, SSH to github.com fails until this action is updated and released.
- Composite actions have no post step, so the key stays in `~/.ssh` for the rest of the job. GitHub-hosted runners are discarded after each job.

## 🔒 Permissions

The action needs no GitHub token permissions.

## Dependencies

- `ssh`, preinstalled on GitHub-hosted Ubuntu runners

## ⚙️ Inputs

| Name              | Required | Description                                                                     |
| ----------------- | -------- | ------------------------------------------------------------------------------- |
| `ssh-private-key` | ✅       | Private SSH key that can read the repositories, such as `ORG_READ_ONLY_SSH_KEY` |

## 📤 Outputs

This action does not set any outputs.

## 🚀 Usage

```yaml
- name: Configure GitHub SSH
  uses: OpenSesame/core-github-actions/.github/actions/configure-github-ssh@<sha> # actions/configure-github-ssh/1.0.0
  with:
    ssh-private-key: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}
```

Replace `<sha>` with the full commit SHA of the tag: `git rev-list -n1 actions/configure-github-ssh/1.0.0`.

## Updating the host keys

1. Fetch the keys: `gh api meta --jq '.ssh_keys[]'`.
2. Check their fingerprints against [GitHub's SSH key fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints).
3. Replace `GITHUB_KNOWN_HOSTS` in `action.yml` and the fingerprints in `action.unit.test.js`, then release a new version.

## Versioning

This action follows the repository's component versioning policy. The initial release uses the PR label `v:a/configure-github-ssh/1.0.0` and the namespaced tag `actions/configure-github-ssh/1.0.0`.
