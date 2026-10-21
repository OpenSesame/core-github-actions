const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actionPath = path.join(__dirname, 'action.yml');

// The pipeline copied into consumer workflows and local get-feature-workspace-name actions.
const legacyPipeline = `
workspace=$(echo "$BRANCH_NAME" | awk -F'/' '{print $NF}' | tr '_' '-' | cut -c 1-15 | sed 's/-*$//')
prefix=$(echo "$workspace" | tr '[:upper:]' '[:lower:]')
printf '%s\\n%s' "$workspace" "$prefix"
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
  const [workspace, namePrefix] = result.stdout.split('\n');

  return { workspace, 'name-prefix': namePrefix };
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
    ['feature/CORE-6135', 'CORE-6135', 'core-6135'],
    ['CORE-6135', 'CORE-6135', 'core-6135'],
    ['dev', 'dev', 'dev'],
    ['bugfix/team/CORE-6135', 'CORE-6135', 'core-6135'],
    ['feature/my_fix', 'my-fix', 'my-fix'],
    ['feature/CORE-6135_add_widget_flow', 'CORE-6135-add-w', 'core-6135-add-w'],
    ['feature/CORE-6135-abcd-xyz', 'CORE-6135-abcd', 'core-6135-abcd'],
    ['feature/ab_____________xyz', 'ab', 'ab'],
    ['feature/-leading', '-leading', '-leading'],
  ])('resolves %s to %s / %s', (branchName, workspace, namePrefix) => {
    const result = runAction(branchName);

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ workspace, 'name-prefix': namePrefix });
  });

  test.each([
    'feature/CORE-6135',
    'CORE-6135',
    'release/2026.10.21',
    'feature/CORE-6135_Add_Widget_Flow',
    'renovate/npm-dev-dependencies',
    'dependabot/npm_and_yarn/lodash-4.17.21',
    'feature/a-b-c-d-e-f-g-h-i-j-k',
    'feature/x'.repeat(10),
    'feature/naïve-branch',
  ])('matches the copied consumer pipeline for %s', branchName => {
    const result = runAction(branchName);

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(runLegacyPipeline(branchName));
  });

  test.each(['', 'feature/', 'feature/---', 'feature/___'])(
    'fails when no workspace name can be derived from %p',
    branchName => {
      const result = runAction(branchName);

      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('::error title=Empty workspace name::');
      expect(result.outputWritten).toBe(false);
    }
  );

  test.each(['feature/a\nname-prefix=injected', 'feature/a\rb', 'feature/a\tb'])(
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
    expect(result.outputs.workspace).toBe('$(touch marker)');
    expect(result.shellMarkerCreated).toBe(false);
  });
});
