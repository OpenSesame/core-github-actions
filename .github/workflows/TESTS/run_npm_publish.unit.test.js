const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { parseGithubOutput } = require('../../../scripts/internal-utils/test-helpers');

const workflowPath = path.join(__dirname, '..', 'run_npm_publish.yml');
const commitSha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

function extractRunScript(stepName) {
  const lines = fs.readFileSync(workflowPath, 'utf8').split('\n');
  const stepStart = lines.indexOf(`      - name: ${stepName}`);
  const runStart = lines.findIndex(
    (line, index) => index > stepStart && line.startsWith('        run: ')
  );

  if (stepStart === -1 || runStart === -1) {
    throw new Error(`Unable to find the '${stepName}' run script`);
  }

  const runValue = lines[runStart].slice('        run: '.length);
  if (!runValue.startsWith('|')) {
    return runValue;
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

// npm and gh stubs log each call as [arg][arg]... so empty arguments stay visible.
const npmStub = `#!/bin/bash
printf '[%s]' npm "$@" >> "$STUB_LOG"; echo >> "$STUB_LOG"
if [[ "$1" == view ]]; then
  if [[ -n "$STUB_GIT_HEAD" ]]; then echo "$STUB_GIT_HEAD"; exit 0; fi
  echo 'npm error code E404' >&2
  exit 1
fi
`;
const ghStub = `#!/bin/bash
printf '[%s]' gh "$@" >> "$STUB_LOG"; echo >> "$STUB_LOG"
`;

function runStep(stepName, { env = {}, files = {} } = {}) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'run-npm-publish-'));
  const binDirectory = path.join(temporaryDirectory, 'bin');
  const repoDirectory = path.join(temporaryDirectory, 'repo');
  const outputPath = path.join(temporaryDirectory, 'github-output');
  const summaryPath = path.join(temporaryDirectory, 'step-summary');
  const logPath = path.join(temporaryDirectory, 'stub-log');

  fs.mkdirSync(binDirectory);
  fs.writeFileSync(path.join(binDirectory, 'npm'), npmStub, { mode: 0o755 });
  fs.writeFileSync(path.join(binDirectory, 'gh'), ghStub, { mode: 0o755 });
  for (const [filePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repoDirectory, filePath)), { recursive: true });
    fs.writeFileSync(path.join(repoDirectory, filePath), contents);
  }
  fs.mkdirSync(repoDirectory, { recursive: true });
  fs.writeFileSync(outputPath, '');
  fs.writeFileSync(logPath, '');

  try {
    const result = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-eo', 'pipefail', '-c', extractRunScript(stepName)],
      {
        cwd: repoDirectory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDirectory}${path.delimiter}${process.env.PATH}`,
          GITHUB_OUTPUT: outputPath,
          GITHUB_STEP_SUMMARY: summaryPath,
          GITHUB_REPOSITORY: 'OpenSesame/example',
          STUB_LOG: logPath,
          STUB_GIT_HEAD: '',
          ...env,
        },
      }
    );

    return {
      ...result,
      outputs: parseGithubOutput(outputPath),
      calls: fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean),
      summary: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '',
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function packageJson(version) {
  return JSON.stringify({ name: '@opensesame/example', version });
}

describe('run_npm_publish eligibility', () => {
  test.each([
    ['false', 'major', 'true'],
    ['false', 'minor', 'true'],
    ['false', 'patch', 'true'],
    ['false', 'none', 'false'],
    ['false', '', 'false'],
    ['false', 'pre-patch', 'false'],
    ['true', 'pre-major', 'true'],
    ['true', 'pre-minor', 'true'],
    ['true', 'pre-patch', 'true'],
    ['true', 'patch', 'false'],
    ['true', 'none', 'false'],
    ['true', '', 'false'],
  ])('prerelease %s with part "%s" sets should-publish=%s', (prerelease, part, expected) => {
    const result = runStep('Determine publish eligibility', {
      env: { PRERELEASE: prerelease, VERSION_PART: part },
    });

    expect(result.status).toBe(0);
    expect(result.outputs['should-publish']).toBe(expected);
  });
});

describe('run_npm_publish Publish package', () => {
  const publishEnv = {
    PRERELEASE: 'false',
    PUBLISH_DIRECTORY: '.',
    VERSION: '1.2.3',
    COMMIT_SHA: commitSha,
  };

  test('publishes latest when the version is not in the registry', () => {
    const result = runStep('Publish package', {
      env: publishEnv,
      files: { 'package.json': packageJson('1.2.3') },
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      '[npm][view][@opensesame/example@1.2.3][gitHead]',
      '[npm][publish][.][--tag][latest]',
    ]);
  });

  test('publishes a beta from the publish directory with the experimental dist-tag', () => {
    const result = runStep('Publish package', {
      env: {
        ...publishEnv,
        PRERELEASE: 'true',
        PUBLISH_DIRECTORY: './dist',
        VERSION: '1.2.3-beta.0',
      },
      files: {
        'package.json': packageJson('1.0.0'),
        'dist/package.json': packageJson('1.2.3-beta.0'),
      },
    });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      '[npm][view][@opensesame/example@1.2.3-beta.0][gitHead]',
      '[npm][publish][./dist][--tag][experimental]',
    ]);
  });

  test('skips npm publish when this commit already published the version', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, STUB_GIT_HEAD: commitSha },
      files: { 'package.json': packageJson('1.2.3') },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('already published from');
    expect(result.calls).toEqual(['[npm][view][@opensesame/example@1.2.3][gitHead]']);
  });

  test('fails without publishing when another commit published the version', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, STUB_GIT_HEAD: otherSha },
      files: { 'package.json': packageJson('1.2.3') },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`already published from ${otherSha} by another run`);
    expect(result.stdout).toContain('Rerun this workflow to pick the next version.');
    expect(result.calls).toEqual(['[npm][view][@opensesame/example@1.2.3][gitHead]']);
  });

  test('fails before contacting the registry when the publish directory has another version', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, PUBLISH_DIRECTORY: './dist' },
      files: { 'package.json': packageJson('1.2.3'), 'dist/package.json': packageJson('1.0.0') },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('./dist/package.json has version 1.0.0, not 1.2.3');
    expect(result.calls).toEqual([]);
  });
});

describe('run_npm_publish tag steps', () => {
  test('creates the GitHub release and its tag at the published commit', () => {
    const result = runStep('Create GitHub release', {
      env: { VERSION: '1.2.3', COMMIT_SHA: commitSha },
    });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      `[gh][release][create][1.2.3][--repo][OpenSesame/example][--target][${commitSha}][--title][1.2.3][--notes][]`,
    ]);
  });

  test('creates the beta tag at the published commit', () => {
    const result = runStep('Create beta tag', {
      env: { VERSION: '1.2.3-beta.0', COMMIT_SHA: commitSha },
    });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      `[gh][api][repos/OpenSesame/example/git/refs][-f][ref=refs/tags/1.2.3-beta.0][-f][sha=${commitSha}][--silent]`,
    ]);
  });
});

describe('run_npm_publish job summary', () => {
  const summaryEnv = {
    JOB_STATUS: 'success',
    BRANCH_NAME: 'main',
    COMMIT_SHA: commitSha,
  };

  test('reports a published latest version', () => {
    const result = runStep('Write job summary', {
      env: {
        ...summaryEnv,
        PRERELEASE: 'false',
        VERSION_PART: 'minor',
        VERSION: '1.3.0',
        SHOULD_PUBLISH: 'true',
        PUBLISH_OUTCOME: 'success',
        TAG_OUTCOME: 'success',
      },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toContain('## Publish Latest');
    expect(result.summary).toContain('- Version: 1.3.0');
    expect(result.summary).toContain('- npm dist-tag: `latest`');
    expect(result.summary).toContain('- GitHub release and tag step: success');
  });

  test('reports a beta push that publishes nothing', () => {
    const result = runStep('Write job summary', {
      env: {
        ...summaryEnv,
        PRERELEASE: 'true',
        VERSION_PART: 'none',
        VERSION: '1.2.3',
        SHOULD_PUBLISH: 'false',
        PUBLISH_OUTCOME: 'skipped',
        TAG_OUTCOME: 'skipped',
      },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toContain('## Publish Beta');
    expect(result.summary).toContain('- Version: not published');
    expect(result.summary).toContain('- npm dist-tag: `experimental`');
    expect(result.summary).toContain('- Beta tag step: skipped');
  });
});
