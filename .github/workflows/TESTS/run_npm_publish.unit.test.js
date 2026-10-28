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
// STUB_REGISTRY is absent (E404), error (E401) or present; STUB_GIT_HEAD is the published gitHead.
const npmStub = `#!/bin/bash
printf '[%s]' npm "$@" >> "$STUB_LOG"; echo >> "$STUB_LOG"
if [[ "$1" == view ]]; then
  case "$STUB_REGISTRY" in
    absent) echo 'npm error code E404' >&2; exit 1 ;;
    error) echo 'npm error code E401' >&2; exit 1 ;;
  esac
  if [[ "$3" == version ]]; then echo "\${2##*@}"; else echo "$STUB_GIT_HEAD"; fi
fi
`;
// STUB_GH_CREATE_EXIT fails release or ref creation; STUB_EXISTING_COMMIT is the existing tag's commit.
const ghStub = `#!/bin/bash
printf '[%s]' gh "$@" >> "$STUB_LOG"; echo >> "$STUB_LOG"
case "$1 $2" in
  'release create') exit "$STUB_GH_CREATE_EXIT" ;;
  'release view') exit "$STUB_GH_RELEASE_VIEW_EXIT" ;;
esac
if [[ "$1" == api && "$2" == */git/refs ]]; then exit "$STUB_GH_CREATE_EXIT"; fi
if [[ "$1" == api && "$2" == */git/ref/tags/* ]]; then
  if [[ -n "$STUB_EXISTING_COMMIT" ]]; then echo "$STUB_EXISTING_COMMIT"; exit 0; fi
  echo 'HTTP 404: Not Found' >&2
  exit 1
fi
`;

// Each history entry is a commit message, or { tag } to tag the commit before it.
function createRepo(repoDirectory, history) {
  const git = (...args) => {
    const result = spawnSync('git', args, {
      cwd: repoDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    }
  };

  git('init', '--quiet', '--initial-branch=main');
  for (const entry of history) {
    if (typeof entry === 'string') {
      git('commit', '--quiet', '--allow-empty', '--message', entry);
    } else {
      git('tag', entry.tag);
    }
  }
}

function runStep(stepName, { env = {}, files = {}, history } = {}) {
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
  if (history) {
    createRepo(repoDirectory, history);
  }
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
          STUB_REGISTRY: 'absent',
          STUB_GIT_HEAD: '',
          STUB_GH_CREATE_EXIT: '0',
          STUB_GH_RELEASE_VIEW_EXIT: '0',
          STUB_EXISTING_COMMIT: '',
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

describe('run_npm_publish credentials', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const versionJob = workflow.slice(
    workflow.indexOf('\n  version:\n'),
    workflow.indexOf('\n  publish:\n')
  );
  const publishJob = workflow.slice(workflow.indexOf('\n  publish:\n'));

  test('keeps the persisted checkout token in a read-only job', () => {
    expect(versionJob).toContain('persist-credentials: true');
    expect(versionJob).toMatch(/permissions:\n\s+contents: read #/);
    expect(versionJob).not.toMatch(/:\s*write\b/);
    expect(versionJob).not.toContain('secrets.');
  });

  test('checks out without credentials in the job that can write', () => {
    expect(publishJob).toMatch(/contents: write #/);
    expect(publishJob).toContain('persist-credentials: false');
    expect(publishJob).not.toContain('persist-credentials: true');
  });
});

describe('run_npm_publish commit', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  test("publishes a merged pull request's merge commit, and github.sha otherwise", () => {
    expect(workflow).toContain(
      'COMMIT_SHA: ${{ github.event.pull_request.merged && github.event.pull_request.merge_commit_sha || github.sha }}'
    );
  });

  test('checks out that commit in both jobs and uses github.sha nowhere else', () => {
    expect(workflow.match(/ref: \$\{\{ env\.COMMIT_SHA \}\}/g)).toHaveLength(2);
    expect(workflow.match(/github\.sha/g)).toHaveLength(2);
  });
});

describe('run_npm_publish version source', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  test('runs github-tag-action only when a release tag exists, and the initial step otherwise', () => {
    expect(workflow).toMatch(
      /- name: Determine version\n\s+id: version\n\s+if: \$\{\{ steps\.release-tag\.outputs\.exists == 'true' \}\}\n\s+uses: anothrNick\/github-tag-action@/
    );
    expect(workflow).toMatch(
      /- name: Determine initial version\n\s+id: initial-version\n\s+if: \$\{\{ steps\.release-tag\.outputs\.exists == 'false' \}\}\n/
    );
  });

  test('takes the version and part from whichever step ran', () => {
    expect(workflow).toContain(
      'version: ${{ steps.version.outputs.new_tag || steps.initial-version.outputs.version }}'
    );
    expect(workflow).toContain(
      'VERSION_PART: ${{ steps.version.outputs.part || steps.initial-version.outputs.part }}'
    );
  });
});

describe('run_npm_publish Find release tag', () => {
  test.each([
    ['no tags', [], 'false'],
    ['only v-prefixed tags', [{ tag: 'v3.0.0' }, '#patch', { tag: 'v3.0.1' }], 'false'],
    ['only beta tags', [{ tag: '1.1.0-beta.0' }], 'false'],
    ['x.y.z tags', [{ tag: '1.0.0' }, '#minor', { tag: '1.1.0' }], 'true'],
    ['mixed v-prefixed and x.y.z tags', [{ tag: '1.0.2' }, '#major', { tag: 'v4.0.2' }], 'true'],
  ])('with %s sets exists=%s', (_case, tags, expected) => {
    const result = runStep('Find release tag', { history: ['Initial commit', ...tags] });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ exists: expected });
  });
});

describe('run_npm_publish Determine initial version', () => {
  const initialEnv = { PRERELEASE: 'false', INITIAL_VERSION: '1.0.0' };

  test.each([
    [
      'a #minor in an earlier commit',
      ['Initial commit', 'Add a feature #minor', 'Tidy up'],
      'minor',
      '1.1.0',
    ],
    [
      'the largest marker in the history',
      ['Initial commit #patch', 'Break it #major', 'Add #minor'],
      'major',
      '2.0.0',
    ],
    ['a #patch in the first commit', ['Initial commit #patch'], 'patch', '1.0.1'],
  ])('bumps initial-version by %s', (_case, history, part, version) => {
    const result = runStep('Determine initial version', { env: initialEnv, history });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ version, part });
  });

  test('counts markers from the whole history when only v-prefixed tags exist', () => {
    const result = runStep('Determine initial version', {
      env: { ...initialEnv, INITIAL_VERSION: '3.0.1' },
      history: ['Initial commit', { tag: 'v3.0.0' }, 'Fix it #patch', { tag: 'v3.0.1' }, 'Tidy up'],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ version: '3.0.2', part: 'patch' });
  });

  test.each([
    ['no markers', ['Initial commit', 'Tidy up']],
    ['only #none', ['Initial commit', 'Tidy up #none']],
  ])('reports part none, and no version, for %s', (_case, history) => {
    const result = runStep('Determine initial version', { env: initialEnv, history });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ part: 'none' });
  });

  test('publishes the first beta of the bumped version', () => {
    const result = runStep('Determine initial version', {
      env: { ...initialEnv, PRERELEASE: 'true' },
      history: ['Initial commit', 'Add a feature #minor'],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ version: '1.1.0-beta.0', part: 'pre-minor' });
  });

  test('numbers the beta after the highest beta of the same version', () => {
    const result = runStep('Determine initial version', {
      env: { ...initialEnv, PRERELEASE: 'true' },
      history: [
        'Initial commit',
        'Add a feature #minor',
        { tag: '1.1.0-beta.0' },
        { tag: '1.1.0-beta.9' },
        { tag: '1.1.0-beta.10' },
        { tag: '1.1.0-beta.x' },
        { tag: '2.0.0-beta.20' },
        { tag: 'v1.1.0-beta.30' },
        'Add another feature',
      ],
    });

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({ version: '1.1.0-beta.11', part: 'pre-minor' });
  });

  test.each(['v1.0.0', '1.0', '01.0.0', ''])(
    'fails when initial-version is "%s"',
    initialVersion => {
      const result = runStep('Determine initial version', {
        env: { ...initialEnv, INITIAL_VERSION: initialVersion },
        history: ['Initial commit #minor'],
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain(`initial-version must be x.y.z, not '${initialVersion}'`);
      expect(result.outputs).toEqual({});
    }
  );
});

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
  const files = { 'package.json': packageJson('1.2.3') };
  const lookupVersion = '[npm][view][@opensesame/example@1.2.3][version]';
  const lookupGitHead = '[npm][view][@opensesame/example@1.2.3][gitHead]';

  test('publishes latest when the registry reports the version missing', () => {
    const result = runStep('Publish package', { env: publishEnv, files });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      lookupVersion,
      '[npm][publish][.][--tag][latest][--ignore-scripts]',
    ]);
    expect(result.outputs).toEqual({ package: '@opensesame/example', 'tag-commit': commitSha });
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
      '[npm][view][@opensesame/example@1.2.3-beta.0][version]',
      '[npm][publish][./dist][--tag][experimental][--ignore-scripts]',
    ]);
  });

  test('stops with the lookup error when the registry query fails for another reason', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, STUB_REGISTRY: 'error' },
      files,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'Could not check whether @opensesame/example@1.2.3 is published'
    );
    expect(result.stdout).toContain('npm error code E401');
    expect(result.calls).toEqual([lookupVersion]);
    expect(result.outputs).toEqual({ package: '@opensesame/example' });
  });

  test('skips npm publish and tags this commit when it already published the version', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, STUB_REGISTRY: 'present', STUB_GIT_HEAD: commitSha },
      files,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`already published from ${commitSha}; skipping npm publish`);
    expect(result.calls).toEqual([lookupVersion, lookupGitHead]);
    expect(result.outputs).toEqual({ package: '@opensesame/example', 'tag-commit': commitSha });
  });

  test('tags the publishing commit and marks the run superseded when another commit published', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, STUB_REGISTRY: 'present', STUB_GIT_HEAD: otherSha },
      files,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`already published from ${otherSha}; tagging that commit`);
    expect(result.calls).toEqual([lookupVersion, lookupGitHead]);
    expect(result.outputs).toEqual({
      package: '@opensesame/example',
      'tag-commit': otherSha,
      superseded: 'true',
    });
  });

  test('fails when the published version records no commit', () => {
    const result = runStep('Publish package', {
      env: { ...publishEnv, STUB_REGISTRY: 'present', STUB_GIT_HEAD: '' },
      files,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the registry records no commit for it');
    expect(result.calls).toEqual([lookupVersion, lookupGitHead]);
    expect(result.outputs).toEqual({ package: '@opensesame/example' });
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

describe('run_npm_publish Create GitHub release', () => {
  const releaseEnv = { VERSION: '1.2.3', TAG_COMMIT: commitSha };
  const create = `[gh][release][create][1.2.3][--repo][OpenSesame/example][--target][${commitSha}][--title][1.2.3][--notes][]`;
  const lookupTag = '[gh][api][repos/OpenSesame/example/git/ref/tags/1.2.3][--jq][.object.sha]';
  const viewRelease = '[gh][release][view][1.2.3][--repo][OpenSesame/example]';

  test('creates the release and its tag on the tag commit', () => {
    const result = runStep('Create GitHub release', { env: releaseEnv });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([lookupTag, create]);
  });

  test('creates the release for a tag that already points to the tag commit', () => {
    const result = runStep('Create GitHub release', {
      env: { ...releaseEnv, STUB_EXISTING_COMMIT: commitSha },
    });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([lookupTag, create]);
  });

  test('fails without creating a release when the tag points to another commit', () => {
    const result = runStep('Create GitHub release', {
      env: { ...releaseEnv, STUB_EXISTING_COMMIT: otherSha },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`the tag points to ${otherSha}`);
    expect(result.calls).toEqual([lookupTag]);
  });

  test('accepts a release that already exists on the same commit', () => {
    const result = runStep('Create GitHub release', {
      env: { ...releaseEnv, STUB_GH_CREATE_EXIT: '1', STUB_EXISTING_COMMIT: commitSha },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`The 1.2.3 release already exists on ${commitSha}`);
    expect(result.calls).toEqual([lookupTag, create, lookupTag, viewRelease]);
  });

  test.each([
    ['there is no tag', {}, 'nothing'],
    [
      'the tag has no release',
      { STUB_EXISTING_COMMIT: commitSha, STUB_GH_RELEASE_VIEW_EXIT: '1' },
      commitSha,
    ],
  ])('fails when creation fails and %s', (_case, env, pointsTo) => {
    const result = runStep('Create GitHub release', {
      env: { ...releaseEnv, STUB_GH_CREATE_EXIT: '1', ...env },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`the tag points to ${pointsTo}`);
  });
});

describe('run_npm_publish Create beta tag', () => {
  const tagEnv = { VERSION: '1.2.3-beta.0', TAG_COMMIT: commitSha };
  const create = `[gh][api][repos/OpenSesame/example/git/refs][-f][ref=refs/tags/1.2.3-beta.0][-f][sha=${commitSha}][--silent]`;

  test('creates the beta tag on the tag commit', () => {
    const result = runStep('Create beta tag', { env: tagEnv });

    expect(result.status).toBe(0);
    expect(result.calls).toEqual([create]);
  });

  test('accepts a tag that already exists on the same commit', () => {
    const result = runStep('Create beta tag', {
      env: { ...tagEnv, STUB_GH_CREATE_EXIT: '1', STUB_EXISTING_COMMIT: commitSha },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`The 1.2.3-beta.0 tag already exists on ${commitSha}`);
  });

  test('fails when the existing tag points to another commit', () => {
    const result = runStep('Create beta tag', {
      env: { ...tagEnv, STUB_GH_CREATE_EXIT: '1', STUB_EXISTING_COMMIT: otherSha },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`the tag points to ${otherSha}`);
  });
});

describe('run_npm_publish Fail superseded run', () => {
  test('fails with a message to rerun for the next version', () => {
    const result = runStep('Fail superseded run', {
      env: { VERSION: '1.2.3', TAG_COMMIT: otherSha },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`1.2.3 was already published from ${otherSha} by another run`);
    expect(result.stdout).toContain(
      'Rerun this workflow to publish this commit as the next version.'
    );
  });
});

describe('run_npm_publish job summary', () => {
  test('states the published latest version and links its release', () => {
    const result = runStep('Write job summary', {
      env: {
        PRERELEASE: 'false',
        PACKAGE: '@opensesame/example',
        VERSION: '1.3.0',
        GITHUB_SERVER_URL: 'https://github.com',
      },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toBe(
      '`@opensesame/example@1.3.0` is published with the `latest` dist-tag and [release 1.3.0](https://github.com/OpenSesame/example/releases/tag/1.3.0).\n'
    );
  });

  test('states the published beta', () => {
    const result = runStep('Write job summary', {
      env: { PRERELEASE: 'true', PACKAGE: '@opensesame/example', VERSION: '1.3.0-beta.0' },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toBe(
      '`@opensesame/example@1.3.0-beta.0` is published with the `experimental` dist-tag.\n'
    );
  });
});
