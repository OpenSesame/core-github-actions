const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_js_checks.yml';

describe('run_js_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts each inline ESLint disable and Prettier ignore comment in JS and TS files', () => {
    const result = count({
      'src/a.js':
        '// eslint-disable-next-line no-console\nconsole.log(1);\n/* eslint-disable */\nfoo(); // eslint-disable-line no-undef\n',
      'src/b.ts': '//prettier-ignore\nconst x = [1,2];\n',
      'src/c.tsx': 'const v = (\n  <div>\n    {/* prettier-ignore */}\n    <span />\n  </div>\n);\n',
      'src/d.mjs': '/* eslint-disable no-console */ /* prettier-ignore */ console.log(2);\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('7');
  });

  test("doesn't count the comment names in strings, docs, other files or .core-services", () => {
    const result = count({
      'test/fixture.test.js':
        "const files = { 'a.js': '// eslint-disable-next-line\\n/* prettier-ignore */\\n' };\n",
      'README.md': '// eslint-disable\n/* prettier-ignore */\n',
      'CHANGELOG.md': '- Counts inline `eslint-disable` and `prettier-ignore` comments.\n',
      '.core-services/generated/validate-repo.mjs': '/* eslint-disable */\n',
      [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile),
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
