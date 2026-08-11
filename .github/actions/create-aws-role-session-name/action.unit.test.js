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

function readOutput(outputPath) {
  const outputLine = fs.readFileSync(outputPath, 'utf8').trim();

  if (!outputLine.startsWith('name=')) {
    throw new Error('Action output must use the expected name=<value> format');
  }

  return outputLine.slice('name='.length);
}

function runAction(inputs) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitize-aws-session-'));
  const outputPath = path.join(temporaryDirectory, 'github-output');

  try {
    const result = spawnSync('bash', ['-c', extractRunScript()], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputPath,
        SESSION_ACTION: inputs.action,
        SESSION_ENVIRONMENT: inputs.environment,
        SESSION_RUN_ID: inputs.runId,
        SESSION_ACTOR: inputs.actor,
      },
    });

    return {
      ...result,
      output: result.status === 0 ? readOutput(outputPath) : undefined,
      shellMarkerCreated: fs.existsSync(
        path.join(temporaryDirectory, 'shell-metacharacter-was-executed')
      ),
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

describe('create-aws-role-session-name', () => {
  test('rejects malformed GitHub output lines', () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'malformed-github-output-'));
    const outputPath = path.join(temporaryDirectory, 'github-output');
    fs.writeFileSync(outputPath, 'value-without-an-output-name\n');

    try {
      expect(() => readOutput(outputPath)).toThrow(
        'Action output must use the expected name=<value> format'
      );
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('replaces brackets in bot actor names', () => {
    const result = runAction({
      action: 'build',
      environment: 'dev',
      runId: '12345',
      actor: 'renovate[bot]',
    });

    expect(result.status).toBe(0);
    expect(result.output).toBe('build-dev-Run12345-@renovate-bot-');
  });

  test('preserves all allowed characters', () => {
    const result = runAction({
      action: 'build_+=,.@-',
      environment: 'stage_+=,.@-',
      runId: '123',
      actor: 'actor_+=,.@-',
    });

    expect(result.status).toBe(0);
    expect(result.output).toBe('build_+=,.@--stage_+=,.@--Run123-@actor_+=,.@-');
  });

  test('replaces invalid characters without executing shell metacharacters', () => {
    const markerName = 'shell-metacharacter-was-executed';
    const result = runAction({
      action: 'build; touch',
      environment: 'feature/name with spaces',
      runId: '123$(false)',
      actor: `actor[bot] && touch ${markerName}`,
    });

    expect(result.status).toBe(0);
    expect(result.output).toBe(
      `build--touch-feature-name-with-spaces-Run123--false--@actor-bot-----touch-${markerName}`.slice(
        0,
        64
      )
    );
    expect(result.shellMarkerCreated).toBe(false);
  });

  test('truncates long values to exactly 64 characters', () => {
    const result = runAction({
      action: 'deploy',
      environment: 'production',
      runId: '12345',
      actor: 'a'.repeat(100),
    });

    expect(result.status).toBe(0);
    expect(result.output).toHaveLength(64);
  });

  test('replaces each invalid multibyte input byte deterministically', () => {
    const result = runAction({
      action: 'build',
      environment: 'dev',
      runId: '12345',
      actor: 'renovateé',
    });

    expect(result.status).toBe(0);
    expect(result.output).toBe('build-dev-Run12345-@renovate--');
  });

  test.each([
    ['build', 'dev', '12345', 'octocat'],
    ['plan', 'stage', '67890', 'renovate[bot]'],
    ['apply', 'prod/us east', '24680', 'actor;$(false)'],
  ])('always produces a valid AWS role session name', (action, environment, runId, actor) => {
    const result = runAction({ action, environment, runId, actor });

    expect(result.status).toBe(0);
    expect(result.output).toMatch(/^[A-Za-z0-9_+=,.@-]{2,64}$/);
  });
});
