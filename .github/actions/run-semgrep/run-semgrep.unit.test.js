const fs = require('fs');
const {
  getPrBaseBranch,
  normalizeBaseline,
  constructSemgrepCommand,
  stageResultsForReviewdog,
  getSemgrepMetrics,
  writeFindingsMarkdown,
  writeConfigMarkdown,
  evaluateScanStatus,
  validateEnvVar,
  REVIEWDOG_INPUT_FILE_NAME,
} = require('./run-semgrep');

const exampleSemgrepOutput = {
  results: [
    {
      path: 'src/error.js',
      end: { line: 111 },
      extra: {
        severity: 'ERROR',
        message: 'This is an error message',
      },
    },
    {
      path: 'src/warning1.js',
      end: { line: 222 },
      extra: {
        severity: 'WARNING',
        message: 'This is a warning message #1',
      },
    },
    {
      path: 'src/info.js',
      end: { line: 333 },
      extra: {
        severity: 'INFO',
        message: 'This is an info message',
      },
    },
    {
      path: 'src/warning2.js',
      end: { line: 444 },
      extra: {
        severity: 'WARNING',
        message: 'This is a warning message #2',
      },
    },
  ],
};
const emptySemgrepOutput = '{"results":[]}';

const https = require('https');

function mockHttpsRequest(responseData, statusCode = 200) {
  https.request = jest.fn((options, callback) => {
    const res = require('stream').Readable({ read() {} });
    res.statusCode = statusCode;
    setImmediate(() => {
      callback(res);
      res.emit('data', Buffer.from(responseData));
      res.emit('end');
    });
    return { on: jest.fn(), end: jest.fn() };
  });
}

describe('getPrBaseBranch', () => {
  const OWNER = 'test-owner';
  const REPO = 'test-repo';
  const BRANCH = 'feature-branch';
  const TOKEN = 'ghp_testtoken';
  let originalRequest;

  beforeAll(() => {
    originalRequest = https.request;
  });

  afterEach(() => {
    https.request = originalRequest;
  });

  it('returns base branch when PR exists', async () => {
    const responseData = JSON.stringify([
      {
        base: { ref: 'main' },
      },
    ]);
    mockHttpsRequest(responseData, 200);
    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBe('main');
  });

  it('returns null when no PR exists', async () => {
    const responseData = JSON.stringify([]);
    mockHttpsRequest(responseData, 200);
    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    const responseData = '';
    mockHttpsRequest(responseData, 404);
    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    const responseData = 'not-json';
    mockHttpsRequest(responseData, 200);
    const baseBranch = await getPrBaseBranch(OWNER, REPO, BRANCH, TOKEN);
    expect(baseBranch).toBeNull();
  });
});

describe('normalizeBaseline', () => {
  const FULL_REPO_NAME = 'repo-owner/test-repo';
  const GITHUB_TOKEN = 'ghp_testtoken';
  const inputBaseline = 'origin/main';
  let originalRequest;

  beforeAll(() => {
    originalRequest = https.request;
  });

  afterEach(() => {
    https.request = originalRequest;
  });

  it('returns input baseline for non-PR event', async () => {
    const hasPr = 'false';
    const githubDetails = {
      eventName: 'push',
      baseRef: '',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repo: FULL_REPO_NAME,
    };
    const baseline = await normalizeBaseline(hasPr, inputBaseline, githubDetails);

    expect(baseline).toBe('origin/main');
  });

  it('returns origin/baseRef for PR event with baseRef', async () => {
    const hasPr = 'true';
    const githubDetails = {
      eventName: 'pull_request',
      baseRef: 'develop',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repo: FULL_REPO_NAME,
    };

    const baseline = await normalizeBaseline(hasPr, inputBaseline, githubDetails);

    expect(baseline).toBe(`origin/${githubDetails.baseRef}`);
  });

  it('fetches base branch when baseRef is not provided', async () => {
    const mockResponse = JSON.stringify([
      {
        base: { ref: 'staging' },
      },
    ]);
    mockHttpsRequest(mockResponse, 200);

    const hasPr = 'true';
    const githubDetails = {
      eventName: 'push',
      baseRef: '',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repo: FULL_REPO_NAME,
    };

    const baseline = await normalizeBaseline(hasPr, inputBaseline, githubDetails);

    expect(baseline).toBe('origin/staging');
  });

  it('falls back to input baseline when base branch cannot be fetched', async () => {
    mockHttpsRequest('', 404);

    const hasPr = 'true';
    const githubDetails = {
      eventName: 'push',
      baseRef: '',
      githubRefName: 'feature-branch',
      githubToken: GITHUB_TOKEN,
      repo: FULL_REPO_NAME,
    };

    const baseline = await normalizeBaseline(hasPr, inputBaseline, githubDetails);

    expect(baseline).toBe('origin/main');
  });
});

describe('constructSemgrepCommand', () => {
  it('constructs args correctly for diff scan mode', () => {
    const baseline = 'origin/main';
    const semgrepConfig = {
      scanMode: 'diff',
      rules: 'p/rule1 p/rule2',
      targets: './src,./lib',
      failLevel: 'warning',
      extraArgs: '--other arg1 --another arg2',
    };
    const cmd = constructSemgrepCommand(baseline, semgrepConfig, 'temp-results.json');

    expect(cmd).toEqual(
      'semgrep --config p/rule1 --config p/rule2 --severity WARNING --json --output temp-results.json --baseline-commit origin/main --other arg1 --another arg2 ./src ./lib'
    );
  });

  it('constructs args correctly for full scan mode', () => {
    const baseline = 'origin/main';
    const semgrepConfig = {
      scanMode: 'full',
      rules: 'p/rule1',
      targets: '',
      failLevel: 'error',
      extraArgs: '',
    };

    const cmd = constructSemgrepCommand(baseline, semgrepConfig, 'temp-results.json');

    expect(cmd).toEqual(
      'semgrep --config p/rule1 --severity ERROR --json --output temp-results.json'
    );
  });
});

describe('stageResultsForReviewdog', () => {
  it('stages results file when it exists', () => {
    const fakeInputFileName = 'fake-results.json';

    jest.spyOn(fs, 'readFileSync').mockImplementation((fileName, encoding) => {
      if (fileName === fakeInputFileName) {
        return JSON.stringify(exampleSemgrepOutput);
      }
    });

    let writtenContent = '';
    jest.spyOn(fs, 'writeFileSync').mockImplementation((fileName, data) => {
      if (fileName === REVIEWDOG_INPUT_FILE_NAME) {
        writtenContent = data;
      }
    });

    stageResultsForReviewdog(fakeInputFileName);

    expect(writtenContent).toContain('E:src/error.js:111 This is an error message');
    expect(writtenContent).toContain('W:src/warning1.js:222 This is a warning message #1');
    expect(writtenContent).toContain('I:src/info.js:333 This is an info message');
    expect(writtenContent).toContain('W:src/warning2.js:444 This is a warning message #2');

    jest.restoreAllMocks();
  });
});

describe('getSemgrepMetrics', () => {
  it('correctly parses semgrep JSON output', () => {
    const fakeInputFileName = 'fake-results.json';

    jest.spyOn(fs, 'readFileSync').mockImplementation((fileName, _encoding) => {
      if (fileName === fakeInputFileName) {
        return JSON.stringify(exampleSemgrepOutput);
      }
    });

    const metrics = getSemgrepMetrics(fakeInputFileName);

    expect(metrics.totalFindings).toBe(4);
    expect(metrics.numErrors).toBe(1);
    expect(metrics.numWarnings).toBe(2);
    expect(metrics.numInfo).toBe(1);

    jest.restoreAllMocks();
  });

  it('handles empty results', () => {
    const fakeInputFileName = 'fake-results.json';

    jest.spyOn(fs, 'readFileSync').mockImplementation((fileName, _encoding) => {
      if (fileName === fakeInputFileName) {
        return JSON.stringify(emptySemgrepOutput);
      }
    });

    const metrics = getSemgrepMetrics(fakeInputFileName);

    expect(metrics.totalFindings).toBe(0);
    expect(metrics.numErrors).toBe(0);
    expect(metrics.numWarnings).toBe(0);
    expect(metrics.numInfo).toBe(0);

    jest.restoreAllMocks();
  });
});

describe('writeFindingsMarkdown', () => {
  it('writes markdown correctly', () => {
    const metrics = {
      totalFindings: 6,
      numErrors: 1,
      numWarnings: 2,
      numInfo: 3,
    };

    const markdown = writeFindingsMarkdown(metrics);

    expect(markdown).toContain('### Scan Findings\n');
    expect(markdown).toContain('| Total | Errors | Warnings | Info |\n');
    expect(markdown).toContain('| 6 | 1 | 2 | 3 |');
  });
});

describe('writeConfigMarkdown', () => {
  it('writes config markdown correctly', () => {
    const config = {
      rules: 'p/rule1 p/rule2',
      targets: './src ./lib',
      scanMode: 'diff',
      failLevel: 'warning',
      extraArgs: '--json',
    };
    const baseline = 'origin/main';

    const markdown = writeConfigMarkdown(baseline, config);

    expect(markdown).toContain('### Scan Config\n');
    expect(markdown).toContain(`- **Rules**: \`${config.rules}\`\n`);
    expect(markdown).toContain(`- **Targets**: \`${config.targets}\`\n`);
    expect(markdown).toContain(`- **Scan mode**: \`${config.scanMode}\`\n`);
    expect(markdown).toContain(`- **Baseline**: \`${baseline}\`\n`);
    expect(markdown).toContain(`- **Fail level**: \`${config.failLevel}\`\n`);
    expect(markdown).toContain(`- **Extra args**: \`${config.extraArgs}\``);
  });
});

describe('evaluateScanStatus', () => {
  it('returns failed for error severity with errors', () => {
    const metrics = { numErrors: 1 };
    const status = evaluateScanStatus('error', metrics);
    expect(status).toBe('failure');
  });
  it('returns failed for warning severity with warnings', () => {
    const metrics = { numErrors: 0, numWarnings: 1 };
    const status = evaluateScanStatus('warning', metrics);
    expect(status).toBe('failure');
  });
  it('returns failed for info severity with any findings', () => {
    const metrics = { numErrors: 0, numWarnings: 0, numInfo: 1 };
    const status = evaluateScanStatus('info', metrics);
    expect(status).toBe('failure');
  });
  it('returns passed when no findings exceed severity', () => {
    const metrics = { numErrors: 0, numWarnings: 1 };
    const status = evaluateScanStatus('error', metrics);
    expect(status).toBe('success');
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
