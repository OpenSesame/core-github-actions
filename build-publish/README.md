### Overview

The publish composite action builds a library and publishes it to the configured registry.

The action will do the following:

1. Run npm commands to build and test the library
2. Run npm command to version the package.json
3. Run npm command to publish the package to the configured registry
