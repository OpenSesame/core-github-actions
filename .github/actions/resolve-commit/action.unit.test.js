const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actionPath = path.join(__dirname, 'action.yml');
const FULL_SHA = '82a23878fbb771f1683e984d4162844479ce79c4';
const TRIGGER_SHA = '0051810c332da4fa8390056b013923965e98e668';

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

// A stub gh that records its arguments and answers like `gh api ... --jq .sha`: it prints
// GH_STUB_STDOUT and exits 0, or prints GH_STUB_STDERR and exits 1 when GH_STUB_FAIL is set.
const GH_STUB = `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$GH_STUB_ARGS"
if [[ -n "\${GH_STUB_FAIL:-}" ]]; then
  printf '%s\\n' '{"message":"No commit found"}'
  printf '%s\\n' "$GH_STUB_STDERR" >&2
  exit 1
fi
printf '%s\\n' "$GH_STUB_STDOUT"
`;

function runAction({ identifier = '', githubSha = TRIGGER_SHA, stub = {} } = {}) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-commit-'));
  const binDirectory = path.join(temporaryDirectory, 'bin');
  const outputPath = path.join(temporaryDirectory, 'github-output');
  const argsPath = path.join(temporaryDirectory, 'gh-args');
  fs.mkdirSync(binDirectory);
  fs.writeFileSync(path.join(binDirectory, 'gh'), GH_STUB, { mode: 0o755 });

  const env = {
    ...process.env,
    PATH: `${binDirectory}:${process.env.PATH}`,
    GITHUB_OUTPUT: outputPath,
    GH_STUB_ARGS: argsPath,
    GH_STUB_STDOUT: stub.stdout ?? FULL_SHA,
    GH_STUB_STDERR: stub.stderr ?? 'gh: No commit found for SHA: x (HTTP 422)',
    GH_TOKEN: 'test-token',
    COMMIT_IDENTIFIER: identifier,
    REPOSITORY: 'OpenSesame/example',
  };
  if (stub.fail) {
    env.GH_STUB_FAIL = '1';
  }
  if (githubSha === null) {
    delete env.GITHUB_SHA;
  } else {
    env.GITHUB_SHA = githubSha;
  }

  try {
    const result = spawnSync('bash', ['-c', extractRunScript()], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env,
    });

    return {
      ...result,
      output: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '',
      ghArgs: fs.existsSync(argsPath) ? fs.readFileSync(argsPath, 'utf8').trim().split('\n') : [],
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function errorLines(stdout) {
  return stdout.split('\n').filter(line => line.startsWith('::error'));
}

describe('resolve-commit', () => {
  test('resolves a tag to the full SHA and writes it as the sha output', () => {
    const result = runAction({ identifier: 'workflows/tf_apply/0.4.0' });

    expect(result.status).toBe(0);
    expect(result.output).toBe(`sha=${FULL_SHA}\n`);
    expect(result.stdout).toContain(`Resolved 'workflows/tf_apply/0.4.0' to ${FULL_SHA}`);
    expect(errorLines(result.stdout)).toEqual([]);
  });

  test('URL-encodes the identifier in the commits API path', () => {
    const result = runAction({ identifier: 'feature/CORE-1 fix#2' });

    expect(result.status).toBe(0);
    expect(result.ghArgs).toEqual([
      'api',
      'repos/OpenSesame/example/commits/feature%2FCORE-1%20fix%232',
      '--jq',
      '.sha',
    ]);
  });

  test('resolves github.sha when commit-identifier is empty', () => {
    const result = runAction({ identifier: '' });

    expect(result.status).toBe(0);
    expect(result.ghArgs[1]).toBe(`repos/OpenSesame/example/commits/${TRIGGER_SHA}`);
    expect(result.output).toBe(`sha=${FULL_SHA}\n`);
  });

  test('fails when commit-identifier is empty and GITHUB_SHA is not set', () => {
    const result = runAction({ identifier: '', githubSha: null });

    expect(result.status).toBe(1);
    expect(errorLines(result.stdout)).toEqual([
      '::error title=Unresolved commit::commit-identifier is empty and GITHUB_SHA is not set.',
    ]);
    expect(result.ghArgs).toEqual([]);
    expect(result.output).toBe('');
  });

  test("fails with the API's reason when the identifier names no commit", () => {
    const result = runAction({
      identifier: 'no-such-ref',
      stub: { fail: true, stderr: 'gh: No commit found for SHA: no-such-ref (HTTP 422)' },
    });

    expect(result.status).toBe(1);
    expect(errorLines(result.stdout)).toEqual([
      "::error title=Unresolved commit::Could not resolve 'no-such-ref' in OpenSesame/example: gh: No commit found for SHA: no-such-ref (HTTP 422)",
    ]);
    expect(result.output).toBe('');
  });

  test('fails when the lookup returns anything but a full SHA', () => {
    const result = runAction({ identifier: 'main', stub: { stdout: 'b44b8934' } });

    expect(result.status).toBe(1);
    expect(errorLines(result.stdout)).toEqual([
      "::error title=Unresolved commit::Could not resolve 'main' in OpenSesame/example to a full commit SHA.",
    ]);
    expect(result.output).toBe('');
  });

  test('escapes the identifier so it cannot start another workflow command', () => {
    const result = runAction({
      identifier: 'bad\n::warning::injected 100%',
      stub: { stdout: 'not-a-sha' },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).not.toMatch(/^::warning::/m);
    expect(errorLines(result.stdout)).toEqual([
      "::error title=Unresolved commit::Could not resolve 'bad%0A::warning::injected 100%25' in OpenSesame/example to a full commit SHA.",
    ]);
  });
});
