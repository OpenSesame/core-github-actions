const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_shell_checks.yml';

describe('run_shell_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts each inline shellcheck disable directive in scripts and workflow run blocks', () => {
    const result = count({
      'scripts/deploy.sh': '#!/bin/bash\n# shellcheck disable=SC2086\necho $1\n',
      'scripts/tool': '#!/usr/bin/env bash\n#shellcheck disable=SC2034,SC2154\n',
      '.github/workflows/ci.yml': '        run: |\n          # shellcheck disable=SC2016\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('3');
  });

  test("doesn't count the directive in docs, strings, .core-services or its own pattern", () => {
    const result = count({
      'README.md': '# shellcheck disable=SC2086\n',
      'CHANGELOG.md': '- Counts inline `# shellcheck disable=` directives.\n',
      'test/a.test.js': "const script = '#!/bin/bash\\n# shellcheck disable=SC2086\\n';\n",
      '.core-services/generated/hook.sh': '# shellcheck disable=SC1091\n',
      [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile),
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
