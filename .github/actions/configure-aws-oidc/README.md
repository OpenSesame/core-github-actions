# Configure AWS OIDC

> **Warning:** This action changes the runner workspace because `get-role-arn` checks out its own repository. Run this action before checking out the consumer repository, or run `actions/checkout` again immediately afterward before using consumer repository files.

## Summary

Configures temporary AWS credentials through GitHub OIDC by performing three operations in order:

1. Create and sanitize an AWS role session name.
2. Resolve the AWS role ARN and region.
3. Assume the resolved role and export temporary AWS credentials for later steps in the same job.

This cohesive utility is intended for jobs that always perform these operations together. It does not support workflows that resolve the role in one job and configure credentials in another.

## Permissions

The calling job must grant these permissions:

```yaml
permissions:
  contents: read
  id-token: write
```

## Inputs

| Name                    | Required | Description                                                            |
| ----------------------- | -------- | ---------------------------------------------------------------------- |
| `domain`                | Yes      | Domain forwarded to the AWS role resolver.                             |
| `environment`           | Yes      | Environment forwarded to the resolver and role-session-name creator.   |
| `action`                | Yes      | Operation label included in the role session name.                     |
| `run-id`                | Yes      | GitHub Actions run ID included in the role session name.               |
| `actor`                 | Yes      | Triggering GitHub actor included in the role session name.             |
| `ORG_READ_ONLY_SSH_KEY` | Yes      | Private SSH key required by `OpenSesame/gha-oidc-access/get-role-arn`. |

`ORG_READ_ONLY_SSH_KEY` is an actual private SSH key and must always be passed from the GitHub `secrets` context. It is declared as an action input only because composite actions do not support a `secrets:` interface.

## Outputs

| Name                | Description                      |
| ------------------- | -------------------------------- |
| `role-arn`          | Resolved AWS role ARN.           |
| `region`            | Resolved AWS region.             |
| `role-session-name` | Sanitized AWS role session name. |

The action does not output credentials or private key material. `aws-actions/configure-aws-credentials` exports temporary credentials into the current job environment; it does not create a persistent named AWS profile.

## Usage with consumer checkout

Use the action before checking out the consumer repository. When later steps need consumer files, check out the consumer immediately afterward:

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - name: Configure AWS credentials
    # Replace with the immutable commit SHA for actions/configure-aws-oidc/1.0.0.
    uses: OpenSesame/core-github-actions/.github/actions/configure-aws-oidc@<immutable-commit-sha>
    with:
      domain: reveng
      environment: ${{ inputs.environment }}
      action: build
      run-id: ${{ github.run_id }}
      actor: ${{ github.actor }}
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}

  # Required when later steps need files from the consumer repository.
  - name: Checkout consumer repository
    uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
    with:
      ref: ${{ inputs.commit-identifier || github.sha }}
```

## Credential-only usage

Jobs that only need AWS credentials can intentionally omit the final consumer checkout:

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - name: Configure AWS credentials
    # Replace with the immutable commit SHA for actions/configure-aws-oidc/1.0.0.
    uses: OpenSesame/core-github-actions/.github/actions/configure-aws-oidc@<immutable-commit-sha>
    with:
      domain: reveng
      environment: ${{ inputs.environment }}
      action: migrate
      run-id: ${{ github.run_id }}
      actor: ${{ github.actor }}
      ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}

  - name: Run migration
    run: aws ecs run-task --cli-input-json "$MIGRATION_TASK"
```

## Dependencies

The action pins each dependency to an immutable commit SHA:

- `OpenSesame/core-github-actions/.github/actions/create-aws-role-session-name` — `actions/create-aws-role-session-name/1.0.0`
- `OpenSesame/gha-oidc-access/get-role-arn` — `v2.0.2`
- `aws-actions/configure-aws-credentials` — `v6.2.3`

## Versioning

The initial release uses the PR label `version:actions/configure-aws-oidc/1.0.0` and the namespaced tag `actions/configure-aws-oidc/1.0.0`.
