jest.mock('node-fetch');
const fetch = require('node-fetch');
const { validateEnvVar, getPrBaseBranch, normalizeBaseline } = require('./normalize-push-baseline');
const { parseGithubOutput } = require('../util/test-helpers');

describe('getPrBaseBranch', () => {
  const OWNER = 'test-owner';
  const REPO = 'test-repo';
  const BRANCH = 'feature-branch';
  const TOKEN = 'ghp_testtoken';

  afterEach(() => {
    fetch.mockClear();
  });

  it('returns base branch when PR exists', async () => {
    const mockResponse = [
      {
        base: { ref: 'main' },
      },
    ];
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBe('main');
  });

  it('returns null when no PR exists', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBeNull();
  });

  it('returns null on fetch error', async () => {
    fetch.mockResolvedValue({
      ok: false,
    });

    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBeNull();
  });
});

describe('normalizeBaseline', () => {
  const REPO_FULL = 'test-owner/test-repo';
  const GITHUB_TOKEN = 'ghp_testtoken';

  afterEach(() => {
    fetch.mockClear();
  });

  it('returns input baseline for non-PR event', async () => {
    const baseline = await normalizeBaseline({
      hasPr: 'false',
      inputBaseline: 'origin/main',
      eventName: 'push',
      ghBaseRef: '',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repoFull: REPO_FULL,
    });
    expect(baseline).toBe('origin/main');
  });

  it('returns origin/baseRef for PR event with baseRef', async () => {
    const baseline = await normalizeBaseline({
      hasPr: 'true',
      inputBaseline: 'origin/main',
      eventName: 'pull_request',
      ghBaseRef: 'develop',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repoFull: REPO_FULL,
    });
    expect(baseline).toBe('origin/develop');
  });

  it('fetches base branch when baseRef is not provided', async () => {
    const mockResponse = [
      {
        base: { ref: 'staging' },
      },
    ];
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const baseline = await normalizeBaseline({
      hasPr: 'true',
      inputBaseline: 'origin/main',
      eventName: 'pull_request',
      ghBaseRef: '',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repoFull: REPO_FULL,
    });
    expect(baseline).toBe('origin/staging');
  });

  it('falls back to input baseline when base branch cannot be fetched', async () => {
    fetch.mockResolvedValue({
      ok: false,
    });

    const baseline = await normalizeBaseline({
      hasPr: 'true',
      inputBaseline: 'origin/main',
      eventName: 'pull_request',
      ghBaseRef: '',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repoFull: REPO_FULL,
    });
    expect(baseline).toBe('origin/main');
  });
});

describe('validateEnvVar', () => {
  const ORIGINAL_EXIT = process.exit;
  const ORIGINAL_CONSOLE_ERROR = console.error;

  beforeEach(() => {
    process.exit = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.exit = ORIGINAL_EXIT;
    console.error = ORIGINAL_CONSOLE_ERROR;
  });

  it('does not exit when env var is set', () => {
    process.env.TEST_VAR = 'value';
    validateEnvVar('TEST_VAR');
    expect(process.exit).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    delete process.env.TEST_VAR;
  });

  it('exits with error when env var is not set', () => {
    delete process.env.TEST_VAR;
    validateEnvVar('TEST_VAR');
    expect(console.error).toHaveBeenCalledWith(
      '::error::Environment variable TEST_VAR is required'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe('normalize-push-baseline main module integration', () => {
  const fs = require('fs');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const tmp = require('os').tmpdir();
  const scriptPath = path.resolve(__dirname, 'normalize-push-baseline.js');
  const ORIGINAL_EXIT = process.exit;
  const ORIGINAL_CONSOLE_ERROR = console.error;
  const ORIGINAL_CONSOLE_LOG = console.log;

  beforeEach(() => {
    process.exit = jest.fn();
    console.error = jest.fn();
    console.log = jest.fn();
    fetch.mockClear();
  });

  afterEach(() => {
    process.exit = ORIGINAL_EXIT;
    console.error = ORIGINAL_CONSOLE_ERROR;
    console.log = ORIGINAL_CONSOLE_LOG;
  });

  it('exits with error if required env vars are missing', async () => {
    const result = spawnSync('node', [scriptPath], {
      cwd: tmp,
      env: { ...process.env },
      encoding: 'utf-8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('::error::Environment variable');
  });

  it('writes github action output with normalized baseline', async () => {
    const outputFile = path.join(tmp, 'gha_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: tmp,
      env: {
        ...process.env,
        HAS_PR: 'true',
        INPUT_BASELINE: 'origin/main',
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_REF_NAME: 'feature-branch',
        GITHUB_TOKEN: 'ghp_testtoken',
        GITHUB_REPOSITORY: 'test-owner/test-repo',
        GITHUB_BASE_REF: 'develop',
        GITHUB_OUTPUT: outputFile,
      },
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.baseline).toBe('origin/develop');
    fs.unlinkSync(outputFile);
  });
});
