const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_gha_checks.yml';

describe('run_gha_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts inline zizmor ignores under .github, with or without a space', () => {
    const result = count({
      '.github/workflows/a.yml': 'run: echo # zizmor: ignore[adhoc-packages] reason\n',
      '.github/actions/b/action.yml':
        '# zizmor:ignore[template-injection] one\n# zizmor: ignore[artipacked] two\n',
      'docs/notes.md': '# zizmor: ignore[outside-github] not counted\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('3');
  });

  test("doesn't count its own pattern", () => {
    const result = count({ [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile) });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });

  test('reports zero without a .github directory', () => {
    const result = count({ 'README.md': '# Fixture\n' });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
