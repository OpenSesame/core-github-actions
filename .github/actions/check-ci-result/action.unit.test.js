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

function runAction(needsJson) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ci-result-'));
  const summaryPath = path.join(temporaryDirectory, 'step-summary');

  try {
    const result = spawnSync('bash', ['-c', extractRunScript()], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, NEEDS_JSON: needsJson },
    });

    return {
      ...result,
      summary: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : undefined,
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function needsJson(results) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(results).map(([job, result]) => [job, { result, outputs: {} }])
    ),
    null,
    2
  );
}

function errorLines(stdout) {
  return stdout.split('\n').filter(line => line.startsWith('::error'));
}

describe('check-ci-result', () => {
  test('passes and summarizes every job when all jobs succeed', () => {
    const result = runAction(
      needsJson({ 'ci-context': 'success', 'app-ci': 'success', semgrep: 'success' })
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('All CI jobs succeeded or were intentionally skipped');
    expect(errorLines(result.stdout)).toEqual([]);
    expect(result.summary).toBe(
      [
        '## CI Result',
        '',
        '| Job | Result |',
        '| --- | --- |',
        '| `ci-context` | success |',
        '| `app-ci` | success |',
        '| `semgrep` | success |',
        '',
      ].join('\n')
    );
  });

  test('passes when a job is skipped', () => {
    const result = runAction(
      needsJson({ 'ci-context': 'success', 'app-ci': 'skipped', semgrep: 'success' })
    );

    expect(result.status).toBe(0);
    expect(errorLines(result.stdout)).toEqual([]);
    expect(result.summary).toContain('| `app-ci` | skipped |');
  });

  test('passes when the ci-context outputs are present', () => {
    const result = runAction(
      JSON.stringify({
        'ci-context': {
          result: 'success',
          outputs: { 'should-run-ci': 'true', 'commit-identifier': 'abc123' },
        },
      })
    );

    expect(result.status).toBe(0);
  });

  test.each(['failure', 'cancelled'])('fails when a job result is %s', jobResult => {
    const result = runAction(
      needsJson({ 'ci-context': 'success', 'app-ci': jobResult, semgrep: 'success' })
    );

    expect(result.status).toBe(1);
    expect(errorLines(result.stdout)).toEqual([
      `::error title=CI Result::Jobs did not succeed: app-ci (${jobResult})`,
    ]);
    expect(result.summary).toContain(`| \`app-ci\` | ${jobResult} |`);
  });

  test('lists every job that did not succeed in one error line', () => {
    const result = runAction(
      needsJson({
        'ci-context': 'success',
        'app-ci': 'failure',
        'infra-ci': 'skipped',
        semgrep: 'cancelled',
        sonar: 'failure',
      })
    );

    expect(result.status).toBe(1);
    expect(errorLines(result.stdout)).toEqual([
      '::error title=CI Result::Jobs did not succeed: app-ci (failure), semgrep (cancelled), sonar (failure)',
    ]);
    expect(result.summary.split('\n').filter(line => line.startsWith('| `'))).toHaveLength(5);
  });

  test.each([
    ['empty', '', 'needs-json is empty'],
    ['whitespace-only', ' \n\t', 'needs-json is empty'],
    ['truncated', '{"app-ci": {"result": "success"', 'not a single valid JSON value'],
    ['non-JSON', 'success', 'not a single valid JSON value'],
    [
      'multi-value',
      '{"a": {"result": "success"}} {"b": {"result": "failure"}}',
      'not a single valid JSON value',
    ],
    ['empty-object', '{}', 'must be a JSON object with at least one job'],
    ['array', '[{"result": "success"}]', 'must be a JSON object with at least one job'],
    ['string', '"success"', 'must be a JSON object with at least one job'],
    ['null', 'null', 'must be a JSON object with at least one job'],
    ['missing-result', '{"app-ci": {"outputs": {}}}', 'Each needs-json entry'],
    ['unknown-result', '{"app-ci": {"result": "neutral"}}', 'Each needs-json entry'],
    ['non-object-entry', '{"app-ci": "success"}', 'Each needs-json entry'],
    ['invalid-job-id', '{"app ci": {"result": "success"}}', 'Each needs-json entry'],
    [
      'trailing-newline-job-id',
      JSON.stringify({ 'app-ci\n': { result: 'success' } }),
      'Each needs-json entry',
    ],
    [
      'workflow-command-job-id',
      JSON.stringify({ 'a\n::warning::injected': { result: 'failure' } }),
      'Each needs-json entry',
    ],
  ])('fails with a clear error for %s input', (_name, input, message) => {
    const result = runAction(input);

    expect(result.status).toBe(1);
    expect(errorLines(result.stdout)).toEqual([
      expect.stringContaining('::error title=Invalid needs-json::'),
    ]);
    expect(result.stdout).toContain(message);
    expect(result.stdout).not.toContain('::warning');
    expect(result.summary).toBeUndefined();
  });
});
