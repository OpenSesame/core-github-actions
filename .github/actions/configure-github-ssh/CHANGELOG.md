# configure-github-ssh action Changelog

All notable changes to the **configure-github-ssh** action are documented in this file.

## 1.0.0

### Added

- Install the `ssh-private-key` input and GitHub's published SSH host keys (ED25519, ECDSA and RSA, from `api.github.com/meta`) under `$RUNNER_TEMP/configure-github-ssh/`, as fresh `0600` files, so the key is removed when the runner cleans up after the job.
- Write `~/.ssh/config` with one `Host github.com` block that uses only that key and requires the pinned host keys, ignoring the runner's global `known_hosts`.
- Fail with an `Existing SSH config` error, before writing anything, when `~/.ssh/config` already exists with other content. The action's own config is accepted, so a job can run it more than once.
- Remove the key, host keys and any config the action created when a step fails partway through.
- Fail with a `Missing SSH key` error when `ssh-private-key` is empty or whitespace.
