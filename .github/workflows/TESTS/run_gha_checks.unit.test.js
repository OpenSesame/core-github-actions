const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

describe('run_gha_checks annotations', () => {
  const runWithStubMise = (stepName, status) => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'stub-mise-'));
    fs.writeFileSync(
      path.join(bin, 'mise'),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@"\nexit ${status}\n`,
      { mode: 0o755 }
    );
    try {
      return runStepInRepository(
        workflowFile,
        'checks',
        stepName,
        { 'README.md': '# Fixture\n' },
        {
          PATH: `${bin}:${process.env.PATH}`,
        }
      );
    } finally {
      fs.rmSync(bin, { recursive: true, force: true });
    }
  };

  test('Lint passes actionlint a format that writes GitHub error annotations', () => {
    const result = runWithStubMise('Lint', 0);

    expect(result.status).toBe(0);
    const args = result.stdout.trimEnd().split('\n');
    expect(args.slice(0, 4)).toEqual(['run', 'lint:gha', '--', '-format']);
    expect(args[4]).toContain(
      '::error file={{$err.Filepath}},line={{$err.Line}},col={{$err.Column}},title=actionlint {{$err.Kind}}::{{$err.Message}}'
    );
  });

  test('Scan passes zizmor the GitHub annotation format', () => {
    const result = runWithStubMise('Scan', 0);

    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd().split('\n')).toEqual([
      'run',
      'scan:gha',
      '--',
      '--format=github',
    ]);
  });

  test.each(['Lint', 'Scan'])('%s fails when its task fails', stepName => {
    expect(runWithStubMise(stepName, 1).status).toBe(1);
  });
});
