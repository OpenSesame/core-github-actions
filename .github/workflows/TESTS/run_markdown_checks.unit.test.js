const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');
const { describeNpmScriptSteps } = require('./technology-checks-contract');

const workflowFile = 'run_markdown_checks.yml';

describeNpmScriptSteps(workflowFile, 'Markdown', ['lint:markdown']);

describe('run_markdown_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts inline markdownlint disables in Markdown files outside .core-services', () => {
    const result = count({
      'README.md':
        '<!-- markdownlint-disable MD013 -->\ntext\n<!-- markdownlint-disable-next-line MD033 -->\n',
      'docs/guide.md': '<!-- markdownlint-disable-file MD041 -->\n',
      '.core-services/standard.md': '<!-- markdownlint-disable MD013 -->\n',
      'notes.txt': 'markdownlint-disable is not counted outside Markdown\n',
      [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile),
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('3');
  });
});
