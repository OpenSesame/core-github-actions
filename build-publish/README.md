### Overview

The publish composite action builds a library and publishes it to the configured registry.

The action will do the following:

1. Run npm commands to build and test the library
2. Run npm command to version the package.json
3. Run npm command to publish the package to the configured registry

You will need to add this as a script in your `package.json`:

```JSON
    "postversion": "cp package.json <output_folder>"
```

You can utilize the cp command, or install and use copyfiles to be system agnostic. After the `npm version` command bumps the version in the `package.json`, you need to copy the updated `package.json` into your output folder (default is `dist`) before `npm publish` runs to ensure it will publish the new version.