### Overview

The publish composite action creates a new GitHub semver tag with an incremented major, minor, patch, or pre-release suffix number, then publishes an NPM package to GitHub packages with this new version number.

The increment defaults to patch or pre-release, depending on whether it is in the main branch, but can be overridden by commit messages using `#major`, `#minor`, or `#patch`.

The action will do the following:

1. Determine what type of release this is.
    - Major, minor, or patch if specified in commit messages
    - Patch if unspecified and on `main` branch
    - `beta-1`, `beta-2`, etc. if unspecified on not on `main` branch
2. Increment the version based on existing tags (if none exist, start with 0.0.0)
3. Create a new tag with this version
4. Publish an NPM package to GitHub packages with this version
