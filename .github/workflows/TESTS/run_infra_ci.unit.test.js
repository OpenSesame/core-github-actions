const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflowPath = path.join(__dirname, '..', 'run_infra_ci.yml');

function extractRunScript(jobId, stepName) {
  const lines = fs.readFileSync(workflowPath, 'utf8').split('\n');
  const jobStart = lines.indexOf(`  ${jobId}:`);
  const stepStart = lines.indexOf(`      - name: ${stepName}`, jobStart);
  const runStart = lines.indexOf('        run: |', stepStart);

  if (jobStart === -1 || stepStart === -1 || runStart === -1) {
    throw new Error(`Unable to find the '${stepName}' run script in job '${jobId}'`);
  }

  const script = [];
  for (const line of lines.slice(runStart + 1)) {
    if (line !== '' && !line.startsWith(' '.repeat(10))) {
      break;
    }
    script.push(line.slice(10));
  }

  return script.join('\n');
}

function runSummary({ jobId, files = {} }) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'run-infra-ci-'));
  const summaryPath = path.join(temporaryDirectory, 'step-summary');
  const repoDirectory = path.join(temporaryDirectory, 'repo');

  fs.mkdirSync(repoDirectory);
  for (const [filePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repoDirectory, filePath)), { recursive: true });
    fs.writeFileSync(path.join(repoDirectory, filePath), contents);
  }

  try {
    const result = spawnSync(
      'bash',
      [
        '--noprofile',
        '--norc',
        '-eo',
        'pipefail',
        '-c',
        extractRunScript(jobId, 'Write job summary'),
      ],
      {
        cwd: repoDirectory,
        encoding: 'utf8',
        env: { ...process.env, STATUS: '0', GITHUB_STEP_SUMMARY: summaryPath },
      }
    );

    return {
      ...result,
      summary: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '',
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const workflow = 'on: push\njobs: {}\n';

describe('run_infra_ci Scan GHA summary', () => {
  test.each([
    ['no .github directory', {}],
    ['no inline ignores', { '.github/workflows/ci.yml': workflow }],
  ])('reports zero inline ignores with %s', (_case, files) => {
    const result = runSummary({ jobId: 'scan-gha', files });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.summary).toContain('✅ No findings.');
    expect(result.summary).toMatch(/^- \*\*Inline ignores\*\* .*: 0$/m);
  });

  test('counts inline ignores across files', () => {
    const result = runSummary({
      jobId: 'scan-gha',
      files: {
        '.github/workflows/a.yml': `${workflow}# zizmor: ignore[adhoc-packages] reason\n`,
        '.github/actions/b/action.yml': '# zizmor:ignore[template-injection] reason\n',
      },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toMatch(/^- \*\*Inline ignores\*\* .*: 2$/m);
  });
});

describe('run_infra_ci Lint GHA summary', () => {
  test('reports zero suppressions without an actionlint config', () => {
    const result = runSummary({
      jobId: 'lint-gha',
      files: { '.github/workflows/ci.yml': workflow },
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.summary).toContain('✅ No findings.');
    expect(result.summary).toMatch(/^- \*\*Suppressions\*\* .*: 0$/m);
  });
});
