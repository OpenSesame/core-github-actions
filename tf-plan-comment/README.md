## ❌ Deprecation Notice

This composite action is no longer maintained by the Core Services team. Use at your own risk.

If your team still relies on this action, you may request CODEOWNER status for this directory to maintain it.

### Overview

The tf-plan-comment composite action initializes actions/github-scripts. Bringing the script under core-github-actions allows us to be more modularized. We can now make any changes to the desired output in one area and have it apply to all the repos utilizing it.

The action will do the following:

1. Output the terraform plan onto the pull request for easy access and readability.

