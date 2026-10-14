const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actionPath = path.join(__dirname, 'action.yml');
const repository = 'OpenSesame/example-repo';
const commit = '0123456789abcdef0123456789abcdef01234567';

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
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

function pullRequest({ number, state = 'open', headRef, headRepo = repository }) {
  return {
    number,
    state,
    html_url: `https://github.com/${repository}/pull/${number}`,
    head: {
      ref: headRef,
      repo: headRepo === null ? null : { full_name: headRepo },
    },
  };
}

function runAction({ response, headRef = '' }) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-open-check-'));
  const binDirectory = path.join(temporaryDirectory, 'bin');
  const outputPath = path.join(temporaryDirectory, 'github-output');
  const responsePath = path.join(temporaryDirectory, 'response');
  const curlArgsPath = path.join(temporaryDirectory, 'curl-args');

  fs.mkdirSync(binDirectory);
  fs.writeFileSync(
    responsePath,
    typeof response === 'string' ? response : JSON.stringify(response)
  );
  fs.writeFileSync(
    path.join(binDirectory, 'curl'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > '${curlArgsPath}'\ncat '${responsePath}'\n`,
    { mode: 0o755 }
  );

  try {
    const result = spawnSync('bash', ['-c', extractRunScript()], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH}`,
        GITHUB_OUTPUT: outputPath,
        GITHUB_REPOSITORY: repository,
        GH_TOKEN: 'test-token',
        COMMIT: commit,
        HEAD_REF: headRef,
      },
    });

    return {
      ...result,
      outputs: result.status === 0 ? readOutputs(outputPath) : undefined,
      curlArgs: fs.existsSync(curlArgsPath)
        ? fs.readFileSync(curlArgsPath, 'utf8').trim().split('\n')
        : [],
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const noPullRequest = { pr_exists: 'false', pr_number: '', pr_url: '' };

function foundPullRequest(number) {
  return {
    pr_exists: 'true',
    pr_number: String(number),
    pr_url: `https://github.com/${repository}/pull/${number}`,
  };
}

describe('pr-open-check', () => {
  test('queries up to 100 pulls associated with the commit', () => {
    const result = runAction({ response: [] });

    expect(result.status).toBe(0);
    expect(result.curlArgs).toContain(
      `https://api.github.com/repos/${repository}/commits/${commit}/pulls?per_page=100`
    );
  });

  test('returns a matching PR beyond the first 30 results', () => {
    const otherPullRequests = Array.from({ length: 40 }, (_value, index) =>
      pullRequest({ number: 100 + index, headRef: `feature/other-${index}` })
    );
    const result = runAction({
      headRef: 'feature/b',
      response: [...otherPullRequests, pullRequest({ number: 200, headRef: 'feature/b' })],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(foundPullRequest(200));
  });

  test('returns the open PR whose head ref matches', () => {
    const result = runAction({
      headRef: 'feature/b',
      response: [
        pullRequest({ number: 1, headRef: 'feature/a' }),
        pullRequest({ number: 2, headRef: 'feature/b' }),
      ],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(foundPullRequest(2));
    expect(result.stdout).toContain(
      `Found open PR #2 for commit '${commit}' on branch 'feature/b'`
    );
  });

  test('ignores an open PR from another branch that shares the commit', () => {
    const result = runAction({
      headRef: 'feature/b',
      response: [pullRequest({ number: 1, headRef: 'feature/a' })],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(noPullRequest);
    expect(result.stdout).toContain(
      `No open PR found for commit '${commit}' on branch 'feature/b'`
    );
  });

  test.each([
    ['a fork', 'someone/example-repo'],
    ['a deleted fork', null],
  ])('ignores a PR from %s with the same branch name', (_description, headRepo) => {
    const result = runAction({
      headRef: 'feature/b',
      response: [pullRequest({ number: 3, headRef: 'feature/b', headRepo })],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(noPullRequest);
  });

  test('ignores a closed PR whose head ref matches', () => {
    const result = runAction({
      headRef: 'feature/b',
      response: [
        pullRequest({ number: 4, state: 'closed', headRef: 'feature/b' }),
        pullRequest({ number: 5, headRef: 'feature/b' }),
      ],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(foundPullRequest(5));
  });

  test('returns the first open PR for the commit when head-ref is not set', () => {
    const result = runAction({
      response: [
        pullRequest({ number: 6, state: 'closed', headRef: 'feature/a' }),
        pullRequest({ number: 7, headRef: 'feature/a', headRepo: 'someone/example-repo' }),
        pullRequest({ number: 8, headRef: 'feature/b' }),
      ],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(foundPullRequest(7));
    expect(result.stdout).toContain(`Found open PR #7 for commit '${commit}'\n`);
  });

  test('reports no PR when the commit has no open PRs', () => {
    const result = runAction({
      response: [pullRequest({ number: 9, state: 'closed', headRef: 'feature/a' })],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(noPullRequest);
  });

  test.each([
    ['an error object', JSON.stringify({ message: 'API rate limit exceeded' })],
    ['an HTML page', '<html><body>Bad gateway</body></html>'],
    ['an empty body', ''],
  ])('warns and reports no PR for %s', (_description, response) => {
    const result = runAction({ headRef: 'feature/b', response });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual(noPullRequest);
    expect(result.stdout).toContain(
      `::warning::Unexpected GitHub API response for commit '${commit}'; assuming no open PR`
    );
  });
});
