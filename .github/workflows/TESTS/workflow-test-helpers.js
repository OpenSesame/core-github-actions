const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflowsDirectory = path.join(__dirname, '..');

function readWorkflow(workflowFile) {
  return fs.readFileSync(path.join(workflowsDirectory, workflowFile), 'utf8');
}

function extractRunScript(workflowFile, jobId, stepName) {
  const lines = readWorkflow(workflowFile).split('\n');
  const jobStart = lines.indexOf(`  ${jobId}:`);
  const stepStart = jobStart === -1 ? -1 : lines.indexOf(`      - name: ${stepName}`, jobStart);
  const runStart =
    stepStart === -1
      ? -1
      : lines.findIndex((line, index) => index > stepStart && /^ {8}run: \|( #.*)?$/.test(line));

  if (jobStart === -1 || stepStart === -1 || runStart === -1) {
    throw new Error(
      `Unable to find the '${stepName}' run script in job '${jobId}' of ${workflowFile}`
    );
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

function createRepository(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-checks-fixture-'));

  for (const [filePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory, filePath)), { recursive: true });
    fs.writeFileSync(path.join(directory, filePath), contents);
  }

  const git = args => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  git(['init', '--quiet']);
  git(['add', '--all']);

  return directory;
}

function parseOutputs(file) {
  if (!fs.existsSync(file)) {
    return {};
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(/=(.*)/).slice(0, 2))
  );
}

function runScript(script, { cwd, env = {} } = {}) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-checks-run-'));
  const outputPath = path.join(temporaryDirectory, 'output');
  const summaryPath = path.join(temporaryDirectory, 'summary');

  try {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
      cwd: cwd || temporaryDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: temporaryDirectory,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        ...env,
      },
    });

    return {
      ...result,
      outputs: parseOutputs(outputPath),
      summary: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '',
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function runStepInRepository(workflowFile, jobId, stepName, files, env) {
  const repository = createRepository(files);
  try {
    return runScript(extractRunScript(workflowFile, jobId, stepName), { cwd: repository, env });
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

function runSetUpNpm(workflowFile, packageJson) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-checks-npm-'));
  const log = path.join(bin, 'calls');
  fs.writeFileSync(
    path.join(bin, 'npm'),
    `#!/usr/bin/env bash\nif [[ "$1" == --version ]]; then echo 11.19.1; else echo "$*" >> '${log}'; fi\n`,
    { mode: 0o755 }
  );
  try {
    const result = runStepInRepository(
      workflowFile,
      'checks',
      'Set up npm',
      { 'package.json': JSON.stringify(packageJson) },
      { PATH: `${bin}:${process.env.PATH}` }
    );
    return { ...result, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

function describeSetUpNpm(workflowFile) {
  describe(`${workflowFile} Set up npm`, () => {
    test('installs the npm version from packageManager', () => {
      const result = runSetUpNpm(workflowFile, { packageManager: 'npm@12.2.1' });

      expect(result.status).toBe(0);
      expect(result.calls).toBe('install --global npm@12.2.1\n');
    });

    test('drops a packageManager hash', () => {
      const result = runSetUpNpm(workflowFile, { packageManager: 'npm@12.2.1+sha512.abc123' });

      expect(result.status).toBe(0);
      expect(result.calls).toBe('install --global npm@12.2.1\n');
    });

    test.each([
      ['no packageManager', {}],
      ['another package manager', { packageManager: 'pnpm@10.0.0' }],
      ['a range instead of a version', { packageManager: 'npm@^12' }],
      ['extra text after the version', { packageManager: 'npm@12.2.1; echo hi' }],
      ['a non-string packageManager', { packageManager: { name: 'npm' } }],
    ])('keeps the bundled npm with %s', (_, packageJson) => {
      const result = runSetUpNpm(workflowFile, packageJson);

      expect(result.status).toBe(0);
      expect(result.calls).toBe('');
      expect(result.stdout).toContain('using the bundled npm');
      expect(result.stdout).toContain('npm 11.19.1');
    });
  });
}

module.exports = {
  createRepository,
  describeSetUpNpm,
  extractRunScript,
  readWorkflow,
  runScript,
  runStepInRepository,
};
