# Terraform Plan Comment Composite Action

## ❌ Deprecation Notice

This composite action is no longer maintained by the Core Services team. Use at your own risk.

If your team still relies on this action, you may request CODEOWNER status for this directory to maintain it.

Known Consumers - Audited Sept 2026

* [catalog-feedback-service](https://github.com/OpenSesame/catalog-feedback-service)
* [catalog-search-proxy](https://github.com/OpenSesame/catalog-search-proxy)
* [catalog-service-template](https://github.com/OpenSesame/catalog-service-template)
* [core-mfe-auth-invitations](https://github.com/OpenSesame/core-mfe-auth-invitations)
* [core-mfe-error-page](https://github.com/OpenSesame/core-mfe-error-page)
* [core-mfe-profile-manager](https://github.com/OpenSesame/core-mfe-profile-manager)
* [core-mfe-template](https://github.com/OpenSesame/core-mfe-template)
* [core-mfe-terms-and-conditions](https://github.com/OpenSesame/core-mfe-terms-and-conditions)
* [core-okta-widget](https://github.com/OpenSesame/core-okta-widget)
* [core-orchestrator](https://github.com/OpenSesame/core-orchestrator)
* [identity-catalog-okta](https://github.com/OpenSesame/identity-catalog-okta)
* [identity-idp-api](https://github.com/OpenSesame/identity-idp-api)
* [identity-learner-okta](https://github.com/OpenSesame/identity-learner-okta)
* [identity-okta](https://github.com/OpenSesame/identity-okta)
* [identity-saml-test-idp](https://github.com/OpenSesame/identity-saml-test-idp)
* [identity-userstore](https://github.com/OpenSesame/identity-userstore)
* [identity-userstore-infrastructure](https://github.com/OpenSesame/identity-userstore-infrastructure)
* [player-infrastructure](https://github.com/OpenSesame/player-infrastructure)
* [player-xapi-statement-router](https://github.com/OpenSesame/player-xapi-statement-router)

### Overview

The tf-plan-comment composite action initializes actions/github-scripts. Bringing the script under core-github-actions allows us to be more modularized. We can now make any changes to the desired output in one area and have it apply to all the repos utilizing it.

The action will do the following:

1. Output the terraform plan onto the pull request for easy access and readability.
