const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');
const { describeNpmScriptSteps } = require('./technology-checks-contract');

const workflowFile = 'run_js_checks.yml';

describeNpmScriptSteps(workflowFile, 'JavaScript or TypeScript', ['lint:js', 'format:prettier']);

describe('run_js_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts inline ESLint disables and Prettier ignores outside .core-services', () => {
    const result = count({
      'src/a.js': '// eslint-disable-next-line no-console\nconsole.log(1);\n/* eslint-disable */\n',
      'src/b.ts': '// prettier-ignore\nconst x = [1,2];\n',
      '.core-services/generated/validate-repo.mjs': '/* eslint-disable */\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('3');
  });

  test("doesn't count its own patterns", () => {
    const result = count({ [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile) });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
