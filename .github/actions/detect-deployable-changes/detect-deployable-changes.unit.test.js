const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  createClassifier,
  createGit,
  createGitHubClient,
  detectMergeChanges,
  detectPullRequestChanges,
  findVerifiedCommit,
  globToRegExp,
  main,
  parseGlobList,
  readConfig,
  readEvent,
} = require('./detect-deployable-changes');

const PROOF_JOB = 'Deploy Dev / Deploy App To S3 / Build and Apply to dev';

const isIgnorable = createClassifier({
  ignore: ['**/*.md', 'docs/', 'material-change/**', 'src/**/*.test.tsx'],
  deploy: ['public/**'],
});

describe('globToRegExp', () => {
  const matches = (pattern, path) => globToRegExp(pattern).test(path);

  it.each([
    ['**/*.md', 'README.md'],
    ['**/*.md', 'docs/guide/setup.md'],
    ['**/*.md', '.github/PULL_REQUEST_TEMPLATE.md'],
    ['*.md', 'README.md'],
    ['docs/', 'docs/a/b.png'],
    ['docs/**', 'docs/a.png'],
    ['.core-services/**', '.core-services/generated/validate-repo.mjs'],
    ['src/**/*.test.tsx', 'src/App.test.tsx'],
    ['src/**/*.test.tsx', 'src/components/Button/Button.test.tsx'],
    ['.github/workflows/on_push_ci.yml', '.github/workflows/on_push_ci.yml'],
    ['file?.txt', 'file1.txt'],
    ['**', 'anything/at/all'],
  ])('%s matches %s', (pattern, path) => {
    expect(matches(pattern, path)).toBe(true);
  });

  it.each([
    ['*.md', 'docs/guide.md'],
    ['docs/', 'docs'],
    ['docs/', 'mydocs/a.md'],
    ['src/*.test.tsx', 'src/a/b.test.tsx'],
    ['.github/workflows/on_push_ci.yml', '.github/workflows/on_push_ci.yml.bak'],
    ['.github/workflows/on_push_ci.yml', 'x.github/workflows/on_push_ciXyml'],
    ['file?.txt', 'file12.txt'],
    ['file?.txt', 'file/.txt'],
  ])('%s does not match %s', (pattern, path) => {
    expect(matches(pattern, path)).toBe(false);
  });

  it.each(['src/[ab].ts', 'src/{a,b}.ts', '!docs/**', 'src\\a.ts', '/docs/**', 'a**/b', 'a//b'])(
    'refuses %s',
    pattern => {
      expect(() => globToRegExp(pattern)).toThrow('Unsupported glob');
    }
  );
});

describe('parseGlobList', () => {
  it('drops blank lines and comments and trims each glob', () => {
    expect(parseGlobList('# heading\n\n  docs/**  \r\n**/*.md\n  # indented comment\n')).toEqual([
      'docs/**',
      '**/*.md',
    ]);
  });

  it('reads an empty or missing list as no globs', () => {
    expect(parseGlobList('')).toEqual([]);
    expect(parseGlobList(undefined)).toEqual([]);
  });
});

describe('createClassifier', () => {
  it.each(['README.md', 'docs/a.png', 'material-change/x.md', 'src/App.test.tsx'])(
    'ignores %s',
    path => {
      expect(isIgnorable(path)).toBe(true);
    }
  );

  it.each(['src/App.tsx', 'public/release-notes.md', 'package-lock.json', 'added-later.json'])(
    'deploys %s',
    path => {
      expect(isIgnorable(path)).toBe(false);
    }
  );

  it('always deploys the listed paths, even when an ignorable glob matches', () => {
    const classify = createClassifier({ ignore: ['.github/**'], alwaysDeploy: ['.github/ignore'] });
    expect(classify('.github/ignore')).toBe(false);
    expect(classify('.github/other')).toBe(true);
  });

  it('deploys everything when nothing is ignorable', () => {
    expect(createClassifier({})('README.md')).toBe(false);
  });
});

const pullRequest = {
  name: 'pull_request',
  action: 'synchronize',
  baseSha: 'base',
  beforeSha: 'before',
  headSha: 'head',
  runAttempt: 1,
};

const detect = (
  event,
  { pullRequestFiles, pushFiles = [], sinceVerifiedFiles = [], search, ancestor = true }
) => {
  const findVerified = jest.fn().mockResolvedValue(search);
  // Only the ranges the gate should diff are known, so diffing any other range fails the test.
  const filesByRange = new Map([
    ['base...head', pullRequestFiles],
    ['before..head', pushFiles],
    ['older..head', sinceVerifiedFiles],
  ]);
  const changedFiles = range => {
    if (!filesByRange.has(range)) throw new Error(`Unexpected diff range ${range}`);
    return filesByRange.get(range);
  };
  const isAncestor = (ancestorSha, descendantSha) => {
    if (ancestorSha !== 'before' || descendantSha !== 'head') {
      throw new Error(`Unexpected ancestry check ${ancestorSha} -> ${descendantSha}`);
    }
    return ancestor;
  };
  const pullRequestCommits = jest.fn(() => ['before', 'older']);
  const result = detectPullRequestChanges(event, {
    changedFiles,
    isAncestor,
    pullRequestCommits,
    findVerifiedCommit: findVerified,
    isIgnorable,
    proofJob: PROOF_JOB,
  });
  return { result, findVerified, pullRequestCommits };
};

describe('detectPullRequestChanges', () => {
  const recordOnlyPush = {
    pullRequestFiles: ['src/App.tsx', 'material-change/x.md'],
    pushFiles: ['material-change/x.md'],
  };
  // Everything a rule under test should not reach would skip, so reaching it fails the test.
  const verifiedAndUnchanged = {
    sinceVerifiedFiles: ['material-change/x.md'],
    search: { verifiedSha: 'older' },
  };
  const failedSearch = { detail: 'the run for before concluded failure' };
  const neverDeployedSearch = {
    detail: 'no earlier commit in the pull request was deployed',
    neverDeployed: true,
  };
  const onlyIgnorableResult = {
    shouldDeploy: false,
    reason: 'The pull request changes only ignorable files.',
  };

  it('always deploys outside pull requests', async () => {
    const { result } = detect(
      { ...pullRequest, name: 'workflow_dispatch' },
      { pullRequestFiles: ['README.md'] }
    );
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: 'workflow_dispatch runs always deploy.',
    });
  });

  it.each([
    ['a re-run', { runAttempt: 2 }, 'Attempt 2 is a re-run, which always deploys.'],
    ['a reopened pull request', { action: 'reopened' }, 'A reopened pull request always deploys.'],
  ])('always deploys %s, even when only ignorable files changed', async (_, change, reason) => {
    const { result, findVerified } = detect(
      { ...pullRequest, ...change },
      { ...verifiedAndUnchanged, pullRequestFiles: ['README.md'], pushFiles: ['README.md'] }
    );
    await expect(result).resolves.toEqual({ shouldDeploy: true, reason });
    expect(findVerified).not.toHaveBeenCalled();
  });

  it('skips an opened pull request that changes only ignorable files', async () => {
    const { result, findVerified } = detect(
      { ...pullRequest, action: 'opened' },
      { pullRequestFiles: ['README.md', 'material-change/x.md'] }
    );
    await expect(result).resolves.toEqual(onlyIgnorableResult);
    expect(findVerified).not.toHaveBeenCalled();
  });

  it('deploys an opened pull request that changes no files', async () => {
    const { result } = detect({ ...pullRequest, action: 'opened' }, { pullRequestFiles: [] });
    await expect(result).resolves.toMatchObject({ shouldDeploy: true });
  });

  // These can follow earlier deploys, so the whole pull request's files can't decide.
  it.each(['labeled', 'edited', 'ready_for_review'])(
    'always deploys a %s event, even when the pull request changes only ignorable files',
    async action => {
      const { result, findVerified } = detect(
        { ...pullRequest, action },
        { ...verifiedAndUnchanged, pullRequestFiles: ['README.md'], pushFiles: ['README.md'] }
      );
      await expect(result).resolves.toEqual({
        shouldDeploy: true,
        reason: `A pull request ${action} event always deploys.`,
      });
      expect(findVerified).not.toHaveBeenCalled();
    }
  );

  it('skips an ignorable push to an ignorable pull request when none of its commits were deployed', async () => {
    const { result, findVerified } = detect(pullRequest, {
      pullRequestFiles: ['README.md', 'material-change/x.md'],
      pushFiles: ['README.md'],
      search: neverDeployedSearch,
    });
    await expect(result).resolves.toEqual(onlyIgnorableResult);
    expect(findVerified).toHaveBeenCalledWith(['before', 'older']);
  });

  it('deploys a push that reverts deployed files, even when only ignorable files remain', async () => {
    const { result } = detect(pullRequest, {
      pullRequestFiles: ['README.md'],
      pushFiles: ['src/button.css'],
    });
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: 'The push changes deployable files.',
      files: ['src/button.css'],
    });
  });

  it('deploys when a pull request with deployable files opens', async () => {
    const { result } = detect(
      { ...pullRequest, action: 'opened' },
      { pullRequestFiles: ['src/App.tsx', 'README.md'] }
    );
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: 'The pull request changes deployable files.',
      files: ['src/App.tsx'],
    });
  });

  it.each([
    ['changes deployable files', recordOnlyPush.pullRequestFiles],
    ['changes only ignorable files', ['README.md']],
  ])('deploys after a force-push, even when the pull request %s', async (_, pullRequestFiles) => {
    const { result, findVerified } = detect(pullRequest, {
      ...recordOnlyPush,
      ...verifiedAndUnchanged,
      pullRequestFiles,
      ancestor: false,
    });
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: 'The push rewrites the pull request history.',
    });
    expect(findVerified).not.toHaveBeenCalled();
  });

  it('deploys a synchronize event without a before commit', async () => {
    const { result } = detect(
      { ...pullRequest, beforeSha: undefined },
      { ...recordOnlyPush, ...verifiedAndUnchanged }
    );
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: 'The push rewrites the pull request history.',
    });
  });

  it('deploys a push that changes deployable files', async () => {
    const { result } = detect(pullRequest, {
      pullRequestFiles: ['src/App.tsx'],
      pushFiles: ['src/App.tsx'],
    });
    await expect(result).resolves.toMatchObject({ shouldDeploy: true, files: ['src/App.tsx'] });
  });

  it.each([
    ['changes deployable files', ['src/App.tsx']],
    ['changes only ignorable files', ['README.md']],
  ])(
    'deploys an empty push, which asks for a fresh run, when the pull request %s',
    async (_, pullRequestFiles) => {
      const { result, findVerified } = detect(pullRequest, {
        ...verifiedAndUnchanged,
        pullRequestFiles,
        pushFiles: [],
      });
      await expect(result).resolves.toEqual({
        shouldDeploy: true,
        reason: 'The push changes no files.',
      });
      expect(findVerified).not.toHaveBeenCalled();
    }
  );

  it('skips an ignorable push when only ignorable files changed since a verified commit', async () => {
    const { result, findVerified, pullRequestCommits } = detect(pullRequest, {
      ...recordOnlyPush,
      sinceVerifiedFiles: ['material-change/x.md', 'README.md'],
      search: { verifiedSha: 'older' },
    });
    await expect(result).resolves.toEqual({
      shouldDeploy: false,
      reason: `Only ignorable files changed since older, whose run passed ${PROOF_JOB}.`,
      verifiedSha: 'older',
    });
    expect(pullRequestCommits).toHaveBeenCalledWith('before', 'base');
    expect(findVerified).toHaveBeenCalledWith(['before', 'older']);
  });

  it('deploys when deployable files changed since the verified commit', async () => {
    const { result } = detect(pullRequest, {
      ...recordOnlyPush,
      sinceVerifiedFiles: ['material-change/x.md', 'src/App.tsx'],
      search: { verifiedSha: 'older' },
    });
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: `Deployable files changed since older, the last commit whose run passed ${PROOF_JOB}.`,
      files: ['src/App.tsx'],
      verifiedSha: 'older',
    });
  });

  it.each([
    ['an earlier deploy failed', recordOnlyPush.pullRequestFiles, failedSearch],
    [
      'an earlier deploy failed, even when the pull request changes only ignorable files',
      ['README.md'],
      failedSearch,
    ],
    [
      'no commit was deployed but the pull request changes deployable files',
      recordOnlyPush.pullRequestFiles,
      neverDeployedSearch,
    ],
  ])('deploys an ignorable push when %s', async (_, pullRequestFiles, search) => {
    const { result } = detect(pullRequest, { ...recordOnlyPush, pullRequestFiles, search });
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: `The push changes only ignorable files, but no earlier commit is verified: ${search.detail}.`,
    });
  });
});

describe('detectMergeChanges', () => {
  const merge = {
    name: 'pull_request',
    action: 'closed',
    merged: true,
    headSha: 'merge',
    runAttempt: 1,
  };
  const detectMerge = (event, { sinceVerifiedFiles = [], search }) => {
    const findVerified = jest.fn().mockResolvedValue(search);
    // Only the range the gate should diff is known, so diffing any other range fails the test.
    const changedFiles = range => {
      if (range !== 'deployed..merge') throw new Error(`Unexpected diff range ${range}`);
      return sinceVerifiedFiles;
    };
    const mainCommits = jest.fn(() => ['previous', 'deployed']);
    const result = detectMergeChanges(event, {
      changedFiles,
      mainCommits,
      findVerifiedCommit: findVerified,
      isIgnorable,
      proofJob: 'Deploy Prod / Deploy App To S3 / Build and Apply to prod',
    });
    return { result, findVerified, mainCommits };
  };
  const verifiedAndUnchanged = {
    sinceVerifiedFiles: ['material-change/x.md'],
    search: { verifiedSha: 'deployed' },
  };

  it.each([
    ['a manual run', { name: 'workflow_dispatch' }, 'workflow_dispatch runs always deploy.'],
    ['a re-run', { runAttempt: 2 }, 'Attempt 2 is a re-run, which always deploys.'],
    [
      'a pull request closed without merging',
      { merged: false },
      'Only a merged pull request can skip the deploy.',
    ],
    [
      'a pull request event other than closed',
      { action: 'synchronize' },
      'Only a merged pull request can skip the deploy.',
    ],
  ])('always deploys %s', async (_, change, reason) => {
    const { result, findVerified } = detectMerge({ ...merge, ...change }, verifiedAndUnchanged);
    await expect(result).resolves.toEqual({ shouldDeploy: true, reason });
    expect(findVerified).not.toHaveBeenCalled();
  });

  it('skips a merge when only ignorable files changed since the last verified merge', async () => {
    const { result, findVerified, mainCommits } = detectMerge(merge, {
      sinceVerifiedFiles: ['material-change/x.md', 'docs/a.png'],
      search: { verifiedSha: 'deployed' },
    });
    await expect(result).resolves.toEqual({
      shouldDeploy: false,
      reason:
        'Only ignorable files changed since deployed, the last merge whose run passed Deploy Prod / Deploy App To S3 / Build and Apply to prod.',
      verifiedSha: 'deployed',
    });
    expect(mainCommits).toHaveBeenCalledWith('merge');
    expect(findVerified).toHaveBeenCalledWith(['previous', 'deployed']);
  });

  it('deploys a merge when deployable files changed since the last verified merge', async () => {
    const { result } = detectMerge(merge, {
      sinceVerifiedFiles: ['README.md', 'src/App.tsx'],
      search: { verifiedSha: 'deployed' },
    });
    await expect(result).resolves.toMatchObject({
      shouldDeploy: true,
      files: ['src/App.tsx'],
      verifiedSha: 'deployed',
    });
  });

  it.each([
    { detail: 'the run for previous concluded failure with the proof job skipped' },
    { detail: 'no earlier commit on the base branch was deployed', neverDeployed: true },
  ])('deploys when no earlier merge is verified: $detail', async search => {
    const { result } = detectMerge(merge, { ...verifiedAndUnchanged, search });
    await expect(result).resolves.toEqual({
      shouldDeploy: true,
      reason: `No earlier merge on the base branch is verified: ${search.detail}.`,
    });
  });
});

describe('findVerifiedCommit', () => {
  const search = (runsBySha, { timeoutMs = 10_000, maxCommits } = {}) => {
    let clock = 0;
    const getDeployRun = jest.fn(async sha => {
      const runs = runsBySha[sha];
      return Array.isArray(runs) ? runs.shift() : runs;
    });
    const result = findVerifiedCommit(Object.keys(runsBySha), {
      getDeployRun,
      proofJob: 'Proof',
      history: 'in the pull request',
      wait: async ms => {
        clock += ms;
      },
      now: () => clock,
      log: () => {},
      intervalMs: 1_000,
      timeoutMs,
      ...(maxCommits && { maxCommits }),
    });
    return { result, getDeployRun };
  };

  const passed = { status: 'completed', conclusion: 'success', proofConclusion: 'success' };
  const skipped = { status: 'completed', conclusion: 'success', proofConclusion: 'skipped' };

  it('returns the newest commit whose run passed the proof job', async () => {
    const { result } = search({ before: passed, older: passed });
    await expect(result).resolves.toEqual({ verifiedSha: 'before' });
  });

  it('passes over skipped or superseded runs and commits with no run of their own', async () => {
    const { result } = search({ before: skipped, middle: undefined, older: passed });
    await expect(result).resolves.toEqual({ verifiedSha: 'older' });
  });

  it('waits for a queued or running deploy to finish', async () => {
    const { result, getDeployRun } = search({
      before: [{ status: 'queued' }, { status: 'in_progress' }, passed],
    });
    await expect(result).resolves.toEqual({ verifiedSha: 'before' });
    expect(getDeployRun).toHaveBeenCalledTimes(3);
  });

  it('does not treat a proof job skipped after a failure as verified', async () => {
    const { result } = search({
      before: { status: 'completed', conclusion: 'failure', proofConclusion: 'skipped' },
      older: passed,
    });
    await expect(result).resolves.toEqual({
      detail: 'the run for before concluded failure with Proof skipped',
    });
  });

  it.each([
    ['failure', 'failure'],
    ['cancelled', 'cancelled'],
    ['success', undefined],
  ])('stops at a run that concluded %s with the proof job %s', async (conclusion, proof) => {
    const { result } = search({
      before: { status: 'completed', conclusion, proofConclusion: proof },
      older: passed,
    });
    // Neither verified nor never deployed.
    await expect(result).resolves.toEqual({ detail: expect.any(String) });
  });

  it('reports a missing proof job as missing', async () => {
    const { result } = search({ before: { status: 'completed', conclusion: 'success' } });
    await expect(result).resolves.toEqual({
      detail: 'the run for before concluded success with Proof missing',
    });
  });

  it('reports that no commit was deployed when it passes over every one', async () => {
    const { result } = search({ before: skipped, older: undefined });
    await expect(result).resolves.toEqual({
      detail: 'no earlier commit in the pull request was deployed',
      neverDeployed: true,
    });
  });

  it('does not report that no commit was deployed when it stops at the commit limit', async () => {
    const runsBySha = Object.fromEntries(
      Array.from({ length: 51 }, (_, index) => [`sha${index}`, skipped])
    );
    const { result, getDeployRun } = search(runsBySha);
    await expect(result).resolves.toEqual({
      detail: 'none of the 50 newest earlier commits has a run that passed Proof',
    });
    expect(getDeployRun).toHaveBeenCalledTimes(50);
  });

  it('honours a smaller commit limit', async () => {
    const { result, getDeployRun } = search(
      { a: skipped, b: skipped, c: passed },
      { maxCommits: 2 }
    );
    await expect(result).resolves.toEqual({
      detail: 'none of the 2 newest earlier commits has a run that passed Proof',
    });
    expect(getDeployRun).toHaveBeenCalledTimes(2);
  });

  it('gives up after the timeout', async () => {
    const { result } = search(
      { before: Array.from({ length: 20 }, () => ({ status: 'in_progress' })) },
      { timeoutMs: 3_000 }
    );
    await expect(result).resolves.toEqual({ detail: 'timed out waiting for the run for before' });
  });
});

describe('createGitHubClient', () => {
  const options = {
    apiUrl: 'https://api.github.test',
    repository: 'owner/repo',
    token: 'token',
    workflowFile: 'on_pr_deploy_dev.yml',
    proofJob: PROOF_JOB,
  };
  const respond = routes =>
    jest.fn(async url => {
      const route = routes.find(([pattern]) => url.includes(pattern));
      if (!route) throw new Error(`Unexpected request ${url}`);
      return { ok: true, json: async () => route[1] };
    });

  it('reads only the newest pull request run of the workflow', async () => {
    const fetchImpl = respond([['/runs?', { workflow_runs: [] }]]);
    await expect(createGitHubClient(options, fetchImpl).getDeployRun('abc')).resolves.toBe(
      undefined
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://api.github.test/repos/owner/repo/actions/workflows/on_pr_deploy_dev.yml/runs?head_sha=abc&event=pull_request&per_page=1'
    );
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it("reads the newest run's proof job by its exact name", async () => {
    const fetchImpl = respond([
      ['/workflows/', { workflow_runs: [{ id: 2, status: 'completed', conclusion: 'success' }] }],
      [
        '/runs/2/jobs',
        {
          total_count: 3,
          jobs: [
            { name: 'Deploy Dev / Deploy Result', conclusion: 'success' },
            {
              name: 'Deploy Stage / Deploy App To S3 / Build and Apply to dev',
              conclusion: 'skipped',
            },
            { name: PROOF_JOB, conclusion: 'success' },
          ],
        },
      ],
    ]);
    await expect(createGitHubClient(options, fetchImpl).getDeployRun('abc')).resolves.toEqual({
      status: 'completed',
      conclusion: 'success',
      proofConclusion: 'success',
    });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://api.github.test/repos/owner/repo/actions/runs/2/jobs?filter=latest&per_page=100&page=1'
    );
  });

  it('reads later pages of jobs until it finds the proof job', async () => {
    const otherJobs = Array.from({ length: 100 }, (_, index) => ({
      name: `Job ${index}`,
      conclusion: 'success',
    }));
    const fetchImpl = jest.fn(async url => {
      if (url.includes('/workflows/')) {
        return {
          ok: true,
          json: async () => ({
            workflow_runs: [{ id: 7, status: 'completed', conclusion: 'success' }],
          }),
        };
      }
      const page = new URL(url).searchParams.get('page');
      const jobs = page === '1' ? otherJobs : [{ name: PROOF_JOB, conclusion: 'success' }];
      return { ok: true, json: async () => ({ total_count: 101, jobs }) };
    });
    await expect(createGitHubClient(options, fetchImpl).getDeployRun('abc')).resolves.toMatchObject(
      {
        proofConclusion: 'success',
      }
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reports an unfinished run without reading its jobs', async () => {
    const fetchImpl = respond([['/workflows/', { workflow_runs: [{ id: 3, status: 'queued' }] }]]);
    await expect(createGitHubClient(options, fetchImpl).getDeployRun('abc')).resolves.toEqual({
      status: 'queued',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports a missing proof job when no caller job stands in for it', async () => {
    const fetchImpl = respond([
      ['/workflows/', { workflow_runs: [{ id: 5, status: 'completed', conclusion: 'success' }] }],
      ['/runs/5/jobs', { total_count: 1, jobs: [{ name: 'Deploy Dev', conclusion: 'skipped' }] }],
    ]);
    await expect(createGitHubClient(options, fetchImpl).getDeployRun('abc')).resolves.toEqual({
      status: 'completed',
      conclusion: 'success',
      proofConclusion: undefined,
    });
  });

  it('reads a run that skipped the reusable call, which lists only caller jobs, as skipped', async () => {
    const fetchImpl = respond([
      ['/workflows/', { workflow_runs: [{ id: 5, status: 'completed', conclusion: 'success' }] }],
      [
        '/runs/5/jobs',
        {
          total_count: 3,
          jobs: [
            { name: 'Detect Deployable Changes', conclusion: 'success' },
            { name: 'Deploy Prod', conclusion: 'skipped' },
            { name: 'Report Status on PR', conclusion: 'success' },
          ],
        },
      ],
    ]);
    const client = createGitHubClient(
      {
        ...options,
        workflowFile: 'on_merge_deploy_thru_prod.yml',
        proofJob: 'Deploy Prod / Build and Push to S3',
        proofCallerJob: 'Deploy Prod',
      },
      fetchImpl
    );
    await expect(client.getDeployRun('abc')).resolves.toEqual({
      status: 'completed',
      conclusion: 'success',
      proofConclusion: 'skipped',
    });
  });

  it("fails with GitHub's message when a request is refused", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => '{"message":"Resource not accessible by integration"}',
    }));
    await expect(createGitHubClient(options, fetchImpl).getDeployRun('abc')).rejects.toThrow(
      'failed with HTTP 403: {"message":"Resource not accessible by integration"}'
    );
  });
});

describe('readConfig', () => {
  const inputs = {
    INPUT_MODE: 'pull-request',
    'INPUT_WORKFLOW-FILE': 'on_pr_deploy_dev.yml',
    'INPUT_PROOF-JOB': PROOF_JOB,
  };

  it('reads the inputs with their defaults', () => {
    expect(readConfig({ ...inputs, 'INPUT_IGNORE-PATHS-FILE': './.github/deploy-ignore' })).toEqual(
      {
        mode: 'pull-request',
        workflowFile: 'on_pr_deploy_dev.yml',
        proofJob: PROOF_JOB,
        proofCallerJob: '',
        ignorePathsFile: '.github/deploy-ignore',
        ignorePaths: '',
        deployPaths: '',
        waitTimeoutMinutes: 40,
        pollIntervalSeconds: 30,
        maxCommits: 50,
        token: '',
      }
    );
  });

  it.each([
    [{ INPUT_MODE: 'prod' }, 'mode must be pull-request or merge'],
    [{ 'INPUT_WORKFLOW-FILE': '.github/workflows/on_pr_deploy_dev.yml' }, 'workflow-file'],
    [{ 'INPUT_WORKFLOW-FILE': '' }, 'workflow-file'],
    [{ 'INPUT_PROOF-JOB': '' }, 'proof-job is required'],
    [{ 'INPUT_WAIT-TIMEOUT-MINUTES': '0' }, 'wait-timeout-minutes'],
    [{ 'INPUT_MAX-COMMITS': '5.5' }, 'max-commits'],
    [{ 'INPUT_IGNORE-PATHS-FILE': '../secrets' }, 'ignore-paths-file'],
    [{ 'INPUT_IGNORE-PATHS-FILE': '/etc/passwd' }, 'ignore-paths-file'],
  ])('refuses %o', (change, message) => {
    expect(() => readConfig({ ...inputs, ...change })).toThrow(message);
  });
});

describe('readEvent', () => {
  const payload = {
    action: 'synchronize',
    before: 'before',
    pull_request: { merged: false, base: { sha: 'base' }, head: { sha: 'head' } },
  };
  const environment = {
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_EVENT_PATH: '/event.json',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: 'merge-ref',
  };
  const readFile = () => JSON.stringify(payload);

  it("deploys the pull request's head in pull-request mode", () => {
    expect(readEvent(environment, 'pull-request', readFile)).toEqual({
      name: 'pull_request',
      action: 'synchronize',
      merged: false,
      baseSha: 'base',
      beforeSha: 'before',
      headSha: 'head',
      runAttempt: 1,
    });
  });

  it('deploys github.sha, the merge commit, in merge mode', () => {
    expect(readEvent(environment, 'merge', readFile)).toMatchObject({ headSha: 'merge-ref' });
  });

  it('reads an event without a pull request', () => {
    expect(
      readEvent({ GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_ATTEMPT: '1' }, 'merge')
    ).toMatchObject({ name: 'workflow_dispatch', merged: false, baseSha: undefined });
  });
});

describe('createGit', () => {
  it('refuses a shallow checkout', () => {
    const run = jest.fn(() => ({ status: 0, stdout: 'true\n', stderr: '' }));
    expect(() => createGit(run).changedFiles('a..b')).toThrow('The checkout is shallow');
  });

  it('checks the history once', () => {
    const run = jest.fn(arguments_ =>
      arguments_[0] === 'rev-parse'
        ? { status: 0, stdout: 'false\n', stderr: '' }
        : { status: 0, stdout: 'a\0b\0', stderr: '' }
    );
    const repo = createGit(run);
    expect(repo.changedFiles('x..y')).toEqual(['a', 'b']);
    expect(repo.changedFiles('y..z')).toEqual(['a', 'b']);
    expect(run.mock.calls.filter(([arguments_]) => arguments_[0] === 'rev-parse')).toHaveLength(1);
  });

  it('bounds both commit lists by the commit limit', () => {
    const run = jest.fn(arguments_ =>
      arguments_[0] === 'rev-parse'
        ? { status: 0, stdout: 'false\n', stderr: '' }
        : { status: 0, stdout: 'a\nb\n', stderr: '' }
    );
    const repo = createGit(run, { commitLimit: 51 });
    expect(repo.mainCommits('head')).toEqual(['a', 'b']);
    expect(repo.pullRequestCommits('before', 'base')).toEqual(['a', 'b']);
    expect(run).toHaveBeenCalledWith(['rev-list', '--first-parent', '--max-count=51', 'head~1']);
    expect(run).toHaveBeenCalledWith([
      'rev-list',
      '--first-parent',
      '--max-count=51',
      'before',
      '^base',
    ]);
  });
});

describe('main', () => {
  // A throwaway repository with no user or system config, so the real git calls
  // run with git's defaults, including rename detection.
  const gitEnvironment = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  let directory;
  let baseSha;

  const runGit = arguments_ =>
    spawnSync('/usr/bin/git', arguments_, {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, ...gitEnvironment },
    });
  const git = (...arguments_) => {
    const result = runGit(arguments_);
    if (result.status !== 0) {
      throw new Error(`git ${arguments_.join(' ')} failed: ${result.stderr}`);
    }
    return result.stdout.trim();
  };
  const commit = message => {
    git('add', '--all');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  const write = (path, content) => {
    mkdirSync(join(directory, path, '..'), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  // Runs main against the throwaway repository with a pull request event.
  const run = async ({ inputs = {}, event = {}, environment = {}, fetchImpl } = {}) => {
    const output = join(directory, 'output');
    const summary = join(directory, 'summary');
    const eventPath = join(directory, 'event.json');
    writeFileSync(
      eventPath,
      JSON.stringify({
        action: 'opened',
        ...event,
        pull_request: {
          base: { sha: baseSha },
          head: { sha: event.headSha },
          merged: event.merged ?? false,
        },
      })
    );
    const gitCalls = jest.fn(runGit);
    const result = await main(
      {
        INPUT_MODE: 'pull-request',
        'INPUT_WORKFLOW-FILE': 'on_pr_deploy_dev.yml',
        'INPUT_PROOF-JOB': PROOF_JOB,
        'INPUT_IGNORE-PATHS': '**/*.md\ndocs/**',
        'INPUT_GITHUB-TOKEN': 'token',
        GITHUB_API_URL: 'https://api.github.test',
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_RUN_ATTEMPT: '1',
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
        ...inputs,
        ...environment,
      },
      {
        fetchImpl: fetchImpl ?? jest.fn(),
        runGit: gitCalls,
        readFile: (path, encoding) =>
          readFileSync(path.startsWith('/') ? path : join(directory, path), encoding),
        wait: async () => {},
      }
    );
    return {
      result,
      gitCalls,
      output: readFileSync(output, 'utf8'),
      summary: readFileSync(summary, 'utf8'),
    };
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'detect-deployable-changes-'));
    git('init', '-q');
    write('src/App.tsx', 'export const App = () => null;\n');
    baseSha = commit('Base');
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it('skips a pull request that changes only ignorable files and writes every output', async () => {
    write('README.md', '# Readme\n');
    const { output, summary } = await run({ event: { headSha: commit('Docs') } });
    expect(output).toBe(
      'should-deploy=false\nreason=The pull request changes only ignorable files.\nverified-sha=\n'
    );
    expect(summary).toContain('## Skipping the deploy');
  });

  it('deploys a file moved out of src/, which rename detection would list only by its new path', async () => {
    mkdirSync(join(directory, 'docs'));
    git('mv', 'src/App.tsx', 'docs/App.tsx');
    const { output, summary } = await run({ event: { headSha: commit('Move') } });
    expect(output).toContain('should-deploy=true\n');
    expect(summary).toContain('## Deploying');
    expect(summary).toContain('- `src/App.tsx`');
  });

  it('reads globs from the ignore file and always deploys the file itself', async () => {
    write('.github/deploy-ignore', '# Ignorable\n.github/**\n');
    write('.github/CODEOWNERS', '* @owner\n');
    const { output, summary } = await run({
      inputs: { 'INPUT_IGNORE-PATHS': '', 'INPUT_IGNORE-PATHS-FILE': '.github/deploy-ignore' },
      event: { headSha: commit('Ignore list') },
    });
    expect(output).toContain('should-deploy=true\n');
    expect(summary).toContain('- `.github/deploy-ignore`');
    expect(summary).not.toContain('CODEOWNERS');
  });

  it('deploys a path a deploy glob matches, even when an ignorable glob matches it too', async () => {
    write('public/notes.md', '# Notes\n');
    const { output } = await run({
      inputs: { 'INPUT_DEPLOY-PATHS': 'public/**' },
      event: { headSha: commit('Public notes') },
    });
    expect(output).toContain('should-deploy=true\n');
  });

  it('deploys a re-run, even of a pull request that changes only ignorable files', async () => {
    write('README.md', '# Readme\n');
    const { summary } = await run({
      event: { headSha: commit('Docs') },
      environment: { GITHUB_RUN_ATTEMPT: '2' },
    });
    expect(summary).toContain('Attempt 2 is a re-run, which always deploys.');
  });

  it('skips an ignorable push after a commit whose run passed the proof job', async () => {
    write('src/App.tsx', 'export const App = () => <main />;\n');
    const beforeSha = commit('Change the app');
    write('README.md', '# Readme\n');
    const headSha = commit('Docs');
    const fetchImpl = jest.fn(async url => ({
      ok: true,
      json: async () =>
        url.includes('/workflows/')
          ? { workflow_runs: [{ id: 1, status: 'completed', conclusion: 'success' }] }
          : { total_count: 1, jobs: [{ name: PROOF_JOB, conclusion: 'success' }] },
    }));
    const { output } = await run({
      event: { action: 'synchronize', before: beforeSha, headSha },
      fetchImpl,
    });
    expect(output).toContain('should-deploy=false\n');
    expect(output).toContain(`verified-sha=${beforeSha}\n`);
    expect(fetchImpl.mock.calls[0][0]).toContain(`head_sha=${beforeSha}`);
  });

  it('deploys and reports the network error behind a failed GitHub request', async () => {
    write('src/App.tsx', 'export const App = () => <main />;\n');
    const beforeSha = commit('Change the app');
    write('README.md', '# Readme\n');
    const headSha = commit('Docs');
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') });
    });
    const { output, summary } = await run({
      event: { action: 'synchronize', before: beforeSha, headSha },
      fetchImpl,
    });
    expect(output).toContain('should-deploy=true\n');
    expect(summary).toContain('Change detection failed: fetch failed: connect ECONNREFUSED');
  });

  it.each([
    ['change detection fails', { event: { headSha: '0'.repeat(40) } }, 'git diff'],
    ['the mode is unknown', { inputs: { INPUT_MODE: 'prod' } }, 'mode must be pull-request'],
    ['a glob is unsupported', { inputs: { 'INPUT_IGNORE-PATHS': '{a,b}' } }, 'Unsupported glob'],
    ['the ignore file is missing', { inputs: { 'INPUT_IGNORE-PATHS-FILE': 'missing' } }, 'ENOENT'],
  ])('deploys when %s', async (_, options, message) => {
    const { output, summary } = await run({ event: { headSha: baseSha }, ...options });
    expect(output).toContain('should-deploy=true\n');
    expect(summary).toContain('Change detection failed');
    expect(summary).toContain(message);
  });

  it('deploys from a shallow clone', async () => {
    write('README.md', '# Readme\n');
    commit('Docs');
    const source = directory;
    directory = mkdtempSync(join(tmpdir(), 'detect-deployable-changes-shallow-'));
    try {
      git('clone', '-q', '--depth', '1', `file://${source}`, '.');
      const { summary } = await run({ event: { headSha: git('rev-parse', 'HEAD') } });
      expect(summary).toContain('The checkout is shallow');
    } finally {
      rmSync(directory, { recursive: true, force: true });
      directory = source;
    }
  });

  describe('in merge mode', () => {
    const PROD_PROOF = 'Deploy Prod / Deploy App To S3 / Build and Apply to prod';
    // Merges a branch with one commit into main, as a pull request merge does.
    const mergeBranch = (name, file, content) => {
      git('switch', '-qc', name);
      write(file, content);
      const pullRequestHead = commit(name);
      git('switch', '-q', '-');
      git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'merge',
        '-q',
        '--no-ff',
        '-m',
        `Merge ${name}`,
        name
      );
      return { pullRequestHead, mergeSha: git('rev-parse', 'HEAD') };
    };
    // Answers for every listed pull request head with one completed run.
    const runs = proofConclusionByHead =>
      jest.fn(async url => {
        const head = new URL(url).searchParams.get('head_sha');
        if (url.includes('/workflows/')) {
          const known = Object.hasOwn(proofConclusionByHead, head);
          return {
            ok: true,
            json: async () => ({
              workflow_runs: known
                ? [{ id: head, status: 'completed', conclusion: 'success' }]
                : [],
            }),
          };
        }
        const runId = url.match(/\/runs\/([^/]+)\/jobs/)[1];
        return {
          ok: true,
          json: async () => ({
            total_count: 1,
            jobs: [{ name: PROD_PROOF, conclusion: proofConclusionByHead[runId] }],
          }),
        };
      });
    const runMerge = (headSha, fetchImpl, inputs = {}) =>
      run({
        inputs: {
          INPUT_MODE: 'merge',
          'INPUT_WORKFLOW-FILE': 'on_merge_deploy_thru_prod.yml',
          'INPUT_PROOF-JOB': PROD_PROOF,
          ...inputs,
        },
        event: { action: 'closed', merged: true, headSha: 'pull-request-head' },
        environment: { GITHUB_SHA: headSha },
        fetchImpl,
      });

    it('skips a merge of ignorable files when the merge before it deployed', async () => {
      const app = mergeBranch('app', 'src/App.tsx', 'export const App = () => <main />;\n');
      const docs = mergeBranch('docs', 'README.md', '# Readme\n');
      const fetchImpl = runs({ [app.pullRequestHead]: 'success' });
      const { output, summary } = await runMerge(docs.mergeSha, fetchImpl);
      expect(output).toContain('should-deploy=false\n');
      expect(output).toContain(`verified-sha=${app.mergeSha}\n`);
      expect(summary).toContain(`since ${app.mergeSha}, the last merge whose run passed`);
    });

    it('passes over skipped merges and diffs from the last one that deployed', async () => {
      const app = mergeBranch('app', 'src/App.tsx', 'export const App = () => <main />;\n');
      const style = mergeBranch('style', 'src/app.css', 'main {}\n');
      const docs = mergeBranch('docs', 'README.md', '# Readme\n');
      const fetchImpl = runs({
        [style.pullRequestHead]: 'skipped',
        [app.pullRequestHead]: 'success',
      });
      const { output, summary } = await runMerge(docs.mergeSha, fetchImpl);
      expect(output).toContain('should-deploy=true\n');
      expect(summary).toContain('- `src/app.css`');
    });

    it('skips the second of two ignorable merges in a row', async () => {
      const app = mergeBranch('app', 'src/App.tsx', 'export const App = () => <main />;\n');
      const record = mergeBranch('record', 'CHANGELOG.md', '# Changelog\n');
      const docs = mergeBranch('docs', 'README.md', '# Readme\n');
      const fetchImpl = runs({
        [record.pullRequestHead]: 'skipped',
        [app.pullRequestHead]: 'success',
      });
      const { output } = await runMerge(docs.mergeSha, fetchImpl);
      expect(output).toContain('should-deploy=false\n');
      expect(output).toContain(`verified-sha=${app.mergeSha}\n`);
    });

    it('deploys when no earlier merge deployed', async () => {
      const docs = mergeBranch('docs', 'README.md', '# Readme\n');
      const { output, summary } = await runMerge(docs.mergeSha, runs({}));
      expect(output).toContain('should-deploy=true\n');
      expect(summary).toContain('no earlier commit on the base branch was deployed');
    });

    it('reads one commit more than max-commits, so it can tell the limit from never deployed', async () => {
      mergeBranch('one', 'docs/one.md', '# One\n');
      mergeBranch('two', 'docs/two.md', '# Two\n');
      const docs = mergeBranch('docs', 'README.md', '# Readme\n');
      const { output, summary, gitCalls } = await runMerge(docs.mergeSha, runs({}), {
        'INPUT_MAX-COMMITS': '2',
      });
      expect(output).toContain('should-deploy=true\n');
      expect(summary).toContain('none of the 2 newest earlier commits has a run that passed');
      expect(gitCalls).toHaveBeenCalledWith([
        'rev-list',
        '--first-parent',
        '--max-count=3',
        `${docs.mergeSha}~1`,
      ]);
    });
  });
});
