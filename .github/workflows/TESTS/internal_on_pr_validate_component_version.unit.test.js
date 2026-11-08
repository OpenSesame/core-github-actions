const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { extractRunScript, readWorkflow, runScript } = require('./workflow-test-helpers');

const workflowFile = 'internal_on_pr_validate_component_version.yml';

const gitEnv = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...gitEnv },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

describe('internal_on_pr_validate_component_version shell', () => {
  test('runs steps in bash with pipefail, so a failed tag lookup fails the step', () => {
    expect(readWorkflow(workflowFile)).toContain('defaults:\n  run:\n    shell: bash\n');
  });
});

describe('internal_on_pr_validate_component_version Get released version tags', () => {
  let directory;
  let checkout;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'released-tags-'));
    const remote = path.join(directory, 'remote.git');
    checkout = path.join(directory, 'checkout');
    git(directory, ['init', '--quiet', '--bare', remote]);
    git(directory, ['init', '--quiet', checkout]);
    fs.writeFileSync(path.join(checkout, 'file.txt'), 'first\n');
    git(checkout, ['add', 'file.txt']);
    git(checkout, ['commit', '--quiet', '-m', 'first']);
    git(checkout, ['remote', 'add', 'origin', remote]);
    git(checkout, ['tag', 'actions/pr-open-check/1.0.0']);
    git(checkout, ['tag', 'workflows/run_semgrep_scan/2.0.0']);
    git(checkout, ['push', '--quiet', 'origin', '--tags']);
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const getReleasedTags = () =>
    runScript(
      extractRunScript(workflowFile, 'validate-version-labels', 'Get released version tags'),
      { cwd: checkout, env: gitEnv }
    );

  test('writes the remote tag names to released_tags.txt', () => {
    const result = getReleasedTags();

    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(checkout, 'released_tags.txt'), 'utf8')).toBe(
      'actions/pr-open-check/1.0.0\nworkflows/run_semgrep_scan/2.0.0\n'
    );
  });

  test('fails when the remote cannot be read', () => {
    git(checkout, ['remote', 'set-url', 'origin', path.join(directory, 'missing.git')]);

    const result = getReleasedTags();

    expect(result.status).not.toBe(0);
  });
});
