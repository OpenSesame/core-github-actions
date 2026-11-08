const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_gha_checks.yml';

describe('run_gha_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts each inline zizmor ignore comment in YAML under .github', () => {
    const result = count({
      '.github/workflows/a.yml':
        'run: echo # zizmor: ignore[adhoc-packages] reason\nrun: | # zizmor: ignore[use-trusted-publishing]\n',
      '.github/actions/b/action.yaml':
        '#zizmor:ignore[template-injection] one\n# zizmor: ignore[artipacked] two\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('4');
  });

  test("doesn't count zizmor ignores in docs, tests, strings or outside .github", () => {
    const result = count({
      '.github/workflows/README.md': '- inline `# zizmor: ignore[<rule>] <reason>`\n',
      '.github/workflows/CHANGELOGS/a.md': '# zizmor: ignore[adhoc-packages] reason\n',
      '.github/workflows/TESTS/a.test.js': "const a = '# zizmor: ignore[adhoc-packages]';\n",
      '.github/workflows/b.yml': 'run: echo "- **Inline ignores** (\\`# zizmor: ignore[...]\\`)"\n',
      'docs/notes.yml': '# zizmor: ignore[outside-github] not counted\n',
      [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile),
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });

  test('reports zero without a .github directory', () => {
    const result = count({ 'README.md': '# Fixture\n' });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
