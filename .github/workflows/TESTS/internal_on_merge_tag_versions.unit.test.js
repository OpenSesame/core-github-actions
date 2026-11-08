const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { extractRunScript, readWorkflow, runScript } = require('./workflow-test-helpers');

const workflowFile = 'internal_on_merge_tag_versions.yml';

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

describe('internal_on_merge_tag_versions trigger', () => {
  const workflow = readWorkflow(workflowFile);

  test('runs only for pull requests into main', () => {
    expect(workflow).toMatch(/pull_request:\n {4}branches: \[main\]\n {4}types: \[closed\]/);
  });

  test('tags the merge commit of the pull request', () => {
    expect(workflow).toContain('ref: ${{ github.event.pull_request.merge_commit_sha }}');
  });
});

describe('internal_on_merge_tag_versions Create Version Tags', () => {
  let directory;
  let remote;
  let checkout;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-versions-'));
    remote = path.join(directory, 'remote.git');
    checkout = path.join(directory, 'checkout');
    git(directory, ['init', '--quiet', '--bare', remote]);
    git(directory, ['init', '--quiet', checkout]);
    fs.writeFileSync(path.join(checkout, 'file.txt'), 'first\n');
    git(checkout, ['add', 'file.txt']);
    git(checkout, ['commit', '--quiet', '-m', 'first']);
    git(checkout, ['remote', 'add', 'origin', remote]);
    git(checkout, ['tag', 'actions/existing/1.0.0']);
    git(checkout, ['push', '--quiet', 'origin', 'refs/tags/actions/existing/1.0.0']);
    git(checkout, ['tag', '--delete', 'actions/existing/1.0.0']);
    fs.writeFileSync(path.join(checkout, 'file.txt'), 'second\n');
    git(checkout, ['commit', '--quiet', '-am', 'second']);
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const createTags = componentTags =>
    runScript(extractRunScript(workflowFile, 'set-version-tags', 'Create Version Tags'), {
      cwd: checkout,
      env: { ...gitEnv, COMPONENT_TAGS: componentTags },
    });

  const remoteTags = () =>
    git(checkout, ['ls-remote', '--tags', '--refs', 'origin'])
      .split('\n')
      .filter(Boolean)
      .map(line => line.split('\t')[1].replace('refs/tags/', ''))
      .sort();

  test('pushes every tag on the checked-out commit', () => {
    const result = createTags('actions/new-action/1.0.0,workflows/new_workflow/2.0.0');

    expect(result.status).toBe(0);
    expect(remoteTags()).toEqual([
      'actions/existing/1.0.0',
      'actions/new-action/1.0.0',
      'workflows/new_workflow/2.0.0',
    ]);
    const head = git(checkout, ['rev-parse', 'HEAD']);
    expect(git(remote, ['rev-parse', 'workflows/new_workflow/2.0.0'])).toBe(head);
    expect(result.summary).toContain('✅ Created and pushed tag: actions/new-action/1.0.0');
  });

  test('pushes no tags when any of them already exists', () => {
    const result = createTags('actions/new-action/1.0.0,actions/existing/1.0.0');

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Tags Already Exist::These tags already exist, so no tags were created: actions/existing/1.0.0'
    );
    expect(remoteTags()).toEqual(['actions/existing/1.0.0']);
  });

  test('does nothing when there are no component tags', () => {
    const result = createTags('');

    expect(result.status).toBe(0);
    expect(remoteTags()).toEqual(['actions/existing/1.0.0']);
  });
});
