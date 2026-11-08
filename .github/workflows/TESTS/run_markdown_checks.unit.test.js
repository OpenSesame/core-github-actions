const { describeSetUpNpm, readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_markdown_checks.yml';

describeSetUpNpm(workflowFile);

describe('run_markdown_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('counts each inline markdownlint-disable directive in Markdown files', () => {
    const result = count({
      'README.md':
        '<!-- markdownlint-disable MD013 -->\ntext\n<!-- markdownlint-disable-next-line MD033 -->\n',
      'docs/guide.md':
        '<!--markdownlint-disable-file MD041-->\n<br> <!-- markdownlint-disable-line MD033 --> <!-- markdownlint-disable-line MD013 -->\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('5');
  });

  test("doesn't count the directive name in prose, inline code, other files or .core-services", () => {
    const result = count({
      'README.md': 'Use `<!-- markdownlint-disable -->` sparingly; markdownlint-disable is baselined.\n',
      'CHANGELOG.md': '- Counts inline `markdownlint-disable` comments.\n',
      '.core-services/standard.md': '<!-- markdownlint-disable MD013 -->\n',
      'notes.txt': '<!-- markdownlint-disable -->\n',
      'test.js': "const fixture = '<!-- markdownlint-disable -->';\n",
      [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile),
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('0');
  });
});
