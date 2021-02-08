### Overview

The create-tag composite action creates a new GitHub tag with an incremented major, minor, patch, or pre-release suffix number. The increment defaults to patch or pre-release, depending on whether it is in the main branch, but can be overridden by commit messages using `#major`, `#minor`, or `#patch`.

The action will do the following:

1. Determine what type of release this is.
    - Major, minor, or patch if specified in commit messages
    - Patch if unspecified and on `main` branch
    - `beta-1`, `beta-2`, etc. if unspecified on not on `main` branch
2. Increment the version based on existing tags (if none exist, start with 0.0.0)
3. Create a new tag with this version.
q1  ### Using this version number to publish a package

If you are publishing a package (e.g. an NPM package) in another GitHub Action job, you can use the new tag variable by following these steps:

1. Add an `id` to the tag creation step. (e.g. `create-tag`).
    ```yaml
    job1:
      steps:
        - name: Create Tag
          id: create-tag
          uses: opensesame/core-github-actions/create-tag@v1
    ```
2. Add these outputs to the job containing this step.
    ```yaml
    job1:
      steps:
        # ...
      outputs:
        new_tag: ${{steps.create-tag.outputs.new_tag}}
        tag: ${{steps.create-tag.outputs.tag}}
          part: ${{steps.create-tag.outputs.part}}
    ```
3. Use these outputs in another job.
    ```yaml
    job2:
      steps:
        - name: Bump Package Version
            run: npm version ${{needs.job1.outputs.new_tag}}
    ```
