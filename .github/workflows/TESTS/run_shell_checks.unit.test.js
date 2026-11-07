const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');
const { describeNpmScriptSteps } = require('./technology-checks-contract');

const workflowFile = 'run_shell_checks.yml';

describeNpmScriptSteps(workflowFile, ['lint:shell', 'format:shell']);

describe('run_shell_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts inline shellcheck disables in any tracked file outside .core-services', () => {
    const result = count({
      'scripts/deploy.sh': '#!/bin/bash\n# shellcheck disable=SC2086\necho $1\n',
      'scripts/tool': '#!/usr/bin/env bash\n# shellcheck disable=SC2034,SC2154\n',
      '.core-services/generated/hook.sh': '# shellcheck disable=SC1091\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('2');
  });

  test("doesn't count its own pattern", () => {
    const result = count({ [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile) });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
