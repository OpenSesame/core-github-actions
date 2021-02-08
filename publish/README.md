### Overview

The publish composite action publishes an NPM package to GitHub packages with a specified version number.

The action will do the following:

1. Run `npm version` to assign the specified version number to the package
2. Run `npm publish` to publish to GitHub packages
