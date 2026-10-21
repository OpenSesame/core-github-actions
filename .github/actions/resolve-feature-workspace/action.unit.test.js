const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actionPath = path.join(__dirname, 'action.yml');

// The name prefix computed by the pipeline copied into consumer workflows. It matches the
// action for branch segments of letters and digits joined by single `-` or `_`.
const legacyPipeline = `
workspace=$(echo "$BRANCH_NAME" | awk -F'/' '{print $NF}' | tr '_' '-' | cut -c 1-15 | sed 's/-*$//')
echo "$workspace" | tr '[:upper:]' '[:lower:]'
`;

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

function readOutputs(outputPath) {
  return Object.fromEntries(
    fs
      .readFileSync(outputPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => {
        const separator = line.indexOf('=');

        if (separator < 1) {
          throw new Error('Action output must use the expected name=<value> format');
        }

        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

function runAction(branchName) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-feature-workspace-'));
  const outputPath = path.join(temporaryDirectory, 'github-output');

  try {
    const result = spawnSync('bash', ['-c', extractRunScript()], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputPath, BRANCH_NAME: branchName },
    });

    return {
      ...result,
      outputs: result.status === 0 ? readOutputs(outputPath) : undefined,
      outputWritten: fs.existsSync(outputPath),
      shellMarkerCreated: fs.existsSync(path.join(temporaryDirectory, 'marker')),
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function runLegacyPipeline(branchName) {
  const result = spawnSync('bash', ['-c', legacyPipeline], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C', BRANCH_NAME: branchName },
  });
  return result.stdout.replace(/\n$/, '');
}

describe('resolve-feature-workspace', () => {
  test('rejects malformed GitHub output lines', () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'malformed-github-output-'));
    const outputPath = path.join(temporaryDirectory, 'github-output');
    fs.writeFileSync(outputPath, 'value-without-an-output-name\n');

    try {
      expect(() => readOutputs(outputPath)).toThrow(
        'Action output must use the expected name=<value> format'
      );
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test.each([
    ['feature/CORE-6135', 'core-6135'],
    ['CORE-6135', 'core-6135'],
    ['dev', 'dev'],
    ['bugfix/team/CORE-6135', 'core-6135'],
    ['feature/my_fix', 'my-fix'],
    ['feature/CORE-6135_add_widget_flow', 'core-6135-add-w'],
    ['feature/CORE-6135-abcd-xyz', 'core-6135-abcd'],
    ['feature/ab_____________xyz', 'ab-xyz'],
    ['feature/CORE-6135--fix', 'core-6135-fix'],
    ['feature/xn--demo', 'xn-demo'],
    ['feature/-leading', 'leading'],
    ['feature/a+b', 'a-b'],
    ['release/2026.10.21', '2026-10-21'],
    ['dependabot/npm_and_yarn/lodash-4.17.21', 'lodash-4-17-21'],
    ['feature/renovate[bot]', 'renovate-bot'],
    ['feature/naïve-branch', 'na-ve-branch'],
  ])('resolves %s to %s', (branchName, workspace) => {
    const result = runAction(branchName);

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ workspace });
  });

  test.each([
    'feature/CORE-6135',
    'CORE-6135',
    'feature/CORE-6135_Add_Widget_Flow',
    'renovate/npm-dev-dependencies',
    'feature/a-b-c-d-e-f-g-h-i-j-k',
    'feature/x'.repeat(10),
  ])('matches the name prefix from the copied consumer pipeline for %s', branchName => {
    const result = runAction(branchName);

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ workspace: runLegacyPipeline(branchName) });
  });

  test.each(['', 'feature/', 'feature/---', 'feature/___', 'feature/+[]'])(
    'fails when no workspace name can be derived from %p',
    branchName => {
      const result = runAction(branchName);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('::error title=Empty workspace name::');
      expect(result.outputWritten).toBe(false);
    }
  );

  test.each(['feature/a\nworkspace=injected', 'feature/a\rb', 'feature/a\tb'])(
    'rejects control characters in %p',
    branchName => {
      const result = runAction(branchName);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('::error title=Invalid branch name::');
      expect(result.outputWritten).toBe(false);
    }
  );

  test('does not execute shell metacharacters in the branch name', () => {
    const result = runAction('feature/$(touch marker)`touch marker`');

    expect(result.status).toBe(0);
    expect(result.outputs.workspace).toBe('touch-marker-to');
    expect(result.shellMarkerCreated).toBe(false);
  });

  test.each([
    'feature/CORE-6135.v2+hotfix',
    'feature/-_-Mixed.Case_Name-_-',
    'feature/emoji-🚀-launch',
    'feature/a@b#c$d%e^f&g*h(i)j',
    'feature/x.y.z',
    'feature/xn--demo',
    'feature/--a--b--',
  ])('produces only a-z, 0-9 and single inner hyphens for %s', branchName => {
    const result = runAction(branchName);

    expect(result.status).toBe(0);
    expect(result.outputs.workspace).toMatch(/^[a-z0-9]([a-z0-9-]{0,13}[a-z0-9])?$/);
    expect(result.outputs.workspace).not.toContain('--');
  });
});
