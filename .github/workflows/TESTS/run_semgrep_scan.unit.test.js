const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractRunScript, runScript } = require('./workflow-test-helpers');

const workflowFile = 'run_semgrep_scan.yml';

function install(semgrepVersion) {
  const binDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'semgrep-install-'));
  const argsPath = path.join(binDirectory, 'python3-args');
  fs.writeFileSync(
    path.join(binDirectory, 'python3'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > '${argsPath}'\n`,
    { mode: 0o755 }
  );

  try {
    const result = runScript(extractRunScript(workflowFile, 'scan', 'Install Semgrep'), {
      env: { PATH: `${binDirectory}:${process.env.PATH}`, SEMGREP_VERSION: semgrepVersion },
    });
    return {
      ...result,
      pythonArgs: fs.existsSync(argsPath)
        ? fs.readFileSync(argsPath, 'utf8').trim().split('\n')
        : undefined,
    };
  } finally {
    fs.rmSync(binDirectory, { recursive: true, force: true });
  }
}

describe('run_semgrep_scan Install Semgrep', () => {
  test('installs the exact version from prebuilt wheels only', () => {
    const result = install('1.183.0');

    expect(result.status).toBe(0);
    expect(result.pythonArgs).toEqual([
      '-m',
      'pip',
      'install',
      '--only-binary',
      ':all:',
      'semgrep==1.183.0',
    ]);
  });

  test.each(['', '1.183', 'latest', '>=1.183.0', '1.183.0rc1'])(
    'fails without installing when semgrep-version is %p',
    semgrepVersion => {
      const result = install(semgrepVersion);

      expect(result.status).toBe(1);
      expect(result.stdout).toContain('semgrep-version must be an exact X.Y.Z version');
      expect(result.pythonArgs).toBeUndefined();
    }
  );
});
