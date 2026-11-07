const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actionPath = path.join(__dirname, 'action.yml');

function extractRunScript() {
  const actionDefinition = fs.readFileSync(actionPath, 'utf8');
  const runBlock = actionDefinition.match(/      run: \|\n([\s\S]+)$/);

  if (!runBlock) {
    throw new Error('Unable to find the action run script');
  }

  return runBlock[1]
    .split('\n')
    .map(line => line.replace(/^ {8}/, ''))
    .join('\n');
}

function runAction({ packageJson, script = 'lint:shell', technology = 'Shell' }) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'run-npm-script-'));

  if (packageJson !== undefined) {
    fs.writeFileSync(path.join(temporaryDirectory, 'package.json'), JSON.stringify(packageJson));
  }

  try {
    return spawnSync('bash', ['--noprofile', '--norc', '-c', extractRunScript()], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: { ...process.env, SCRIPT: script, TECHNOLOGY: technology },
    });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

describe('run-npm-script action', () => {
  test('runs a script that exists', () => {
    const result = runAction({
      packageJson: { scripts: { 'lint:shell': 'echo shell-lint-ran' } },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('shell-lint-ran');
    expect(result.stdout).not.toContain('::error');
  });

  test("fails with the script's exit code when the script fails", () => {
    const result = runAction({
      packageJson: { scripts: { 'lint:shell': 'exit 3' } },
    });

    expect(result.status).toBe(3);
    expect(result.stdout).not.toContain('::error');
  });

  test('fails with a missing-script error that names the technology', () => {
    const result = runAction({
      packageJson: { scripts: { 'format:shell': 'echo wrong-script' } },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Missing npm script::Shell files are present, but package.json has no lint:shell script.'
    );
    expect(result.stdout).not.toContain('wrong-script');
  });

  test('fails with a missing-script error when package.json has no scripts', () => {
    const result = runAction({
      packageJson: { name: 'fixture' },
      script: 'scan:terraform',
      technology: 'Terraform',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Missing npm script::Terraform files are present, but package.json has no scan:terraform script.'
    );
  });

  test('fails with a missing-package.json error', () => {
    const result = runAction({ packageJson: undefined });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Missing package.json::Shell files are present, but there is no package.json to run lint:shell from.'
    );
  });

  test('treats a non-string script entry as missing', () => {
    const result = runAction({
      packageJson: { scripts: { 'lint:shell': { command: 'echo nope' } } },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Missing npm script::');
  });
});
