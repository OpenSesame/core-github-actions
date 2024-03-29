### Core Github Actions

The core team uses github actions to standardize our CI/CD process. Our github workflows compose these actions to deploy and cleanup our software.

* [build-apply](build-apply)
* [build-publish](build-publish)
* [cleanup](cleanup)
* [deploy](deploy)

### Motivation

We introduced these modules to standardize the way we build and deploy software, so that we can have a consistent way to build and test our code before deployment. They also standardize the way we use terraform for applying and destroying infrastructure changes from a branch.

A technical issue is also solved: terraform providers cannot be reliably initialized from values that are retrieved dynamically during apply or destroy. Provider configuration values must be supplied via an input or an environment variable. The pattern established by these actions retrieves the secrets from AWS Secrets Manager and supplies them when running terraform commands.

### Testing

To test changes on a branch before it is published, you can push your branch up, and then change the consuming repo's github workflow to use the version on branch. For example, if you are working on branch `feature/CORE-123`, you can change the workflow like this to use the branch version:

```
uses: opensesame/core-github-actions/build-apply@feature/CORE-123
```
