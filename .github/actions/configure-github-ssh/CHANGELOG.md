# configure-github-ssh action Changelog

All notable changes to the **configure-github-ssh** action are documented in this file.

## 1.0.0

### Added

- Install the `ssh-private-key` input at `~/.ssh/github_read_only_key`, and GitHub's published SSH host keys (ED25519, ECDSA and RSA, from `api.github.com/meta`) at `~/.ssh/github_known_hosts`, all under `umask 077`.
- Write `~/.ssh/config` with one `Host github.com` block that uses only that key and requires the pinned host keys, ignoring the runner's global `known_hosts`.
- Fail with an `Existing SSH config` error, before writing anything, when `~/.ssh/config` already exists with other content. The action's own config is accepted, so a job can run it more than once.
- Fail with a `Missing SSH key` error when `ssh-private-key` is empty or whitespace.
