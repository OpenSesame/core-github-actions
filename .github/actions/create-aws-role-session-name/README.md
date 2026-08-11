# Create AWS Role Session Name

## Summary

Builds a deterministic, AWS-compatible role session name from workflow context. This action only constructs and sanitizes the name; it does not configure AWS credentials.

The unsanitized name has this form:

```text
<action>-<environment>-Run<run-id>-@<actor>
```

## Inputs

| Name          | Required | Description                                 |
| ------------- | -------- | ------------------------------------------- |
| `action`      | Yes      | Operation being performed, such as `build`. |
| `environment` | Yes      | Target environment.                         |
| `run-id`      | Yes      | GitHub Actions run ID.                      |
| `actor`       | Yes      | GitHub actor that triggered the workflow.   |

## Outputs

| Name   | Description                       |
| ------ | --------------------------------- |
| `name` | AWS-compatible role session name. |

## Sanitization contract

- The allowed characters are `A-Z`, `a-z`, `0-9`, `_`, `+`, `=`, `,`, `.`, `@`, and `-`.
- Each invalid byte is replaced with `-`. For example, `renovate[bot]` becomes `renovate-bot-` within the complete session name.
- The result is truncated to at most 64 characters.
- The action fails if the result contains fewer than two characters.
- Character processing uses the C locale for deterministic byte handling.
- Inputs are passed to the shell through environment variables and are never interpolated into shell source.

The output always matches `^[A-Za-z0-9_+=,.@-]{2,64}$`.

## Usage

After version `1.0.0` is released, pin usage to the immutable commit SHA associated with `actions/create-aws-role-session-name/1.0.0`:

```yaml
- name: Build AWS role session name
  id: aws-session
  # Replace with the immutable commit SHA for actions/create-aws-role-session-name/1.0.0.
  uses: OpenSesame/core-github-actions/.github/actions/create-aws-role-session-name@<immutable-commit-sha>
  with:
    action: build
    environment: ${{ inputs.environment }}
    run-id: ${{ github.run_id }}
    actor: ${{ github.actor }}

- name: Use role session name
  env:
    ROLE_SESSION_NAME: ${{ steps.aws-session.outputs.name }}
  run: printf '%s\n' "$ROLE_SESSION_NAME"
```

This action does not require additional GitHub token permissions.

## Versioning

This action follows the repository's component versioning policy. The initial release uses the PR label `version:actions/create-aws-role-session-name/1.0.0` and the namespaced tag `actions/create-aws-role-session-name/1.0.0`.
