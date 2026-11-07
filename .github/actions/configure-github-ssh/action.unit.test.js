const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const actionDefinition = fs.readFileSync(path.join(__dirname, 'action.yml'), 'utf8');

const documentedFingerprints = [
  'SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU',
  'SHA256:p2QAMXNIC1TJYWeIOttrVc98/R1BUFWu3/LiyKgUfQM',
  'SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s',
];

function extractRunScript() {
  const runBlock = actionDefinition.match(/ {6}run: \|\n([\s\S]+)$/);
  if (!runBlock) {
    throw new Error('Unable to find the action run script');
  }
  return runBlock[1]
    .split('\n')
    .map(line => line.replace(/^ {8}/, ''))
    .join('\n');
}

function extractKnownHosts() {
  const block = actionDefinition.match(/ {8}GITHUB_KNOWN_HOSTS: \|\n((?: {10}.+\n)+)/);
  if (!block) {
    throw new Error('Unable to find GITHUB_KNOWN_HOSTS');
  }
  return block[1].replace(/^ {10}/gm, '');
}

const cleanups = [];
afterEach(() => {
  while (cleanups.length > 0) {
    fs.rmSync(cleanups.pop(), { recursive: true, force: true });
  }
});

function newRunner() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'configure-github-ssh-'));
  cleanups.push(root);
  const runner = {
    home: path.join(root, 'home'),
    temp: path.join(root, 'runner-temp'),
  };
  fs.mkdirSync(runner.home);
  fs.mkdirSync(runner.temp);
  runner.ssh = path.join(runner.home, '.ssh');
  runner.secrets = path.join(runner.temp, 'configure-github-ssh');
  runner.key = path.join(runner.secrets, 'github_read_only_key');
  runner.knownHosts = path.join(runner.secrets, 'github_known_hosts');
  runner.config = path.join(runner.ssh, 'config');
  return runner;
}

function runAction(runner, key = 'fake-private-key', extraEnv = {}) {
  return spawnSync('bash', ['--noprofile', '--norc', '-c', extractRunScript()], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: runner.home,
      RUNNER_TEMP: runner.temp,
      SSH_PRIVATE_KEY: key,
      GITHUB_KNOWN_HOSTS: extractKnownHosts(),
      ...extraEnv,
    },
  });
}

const mode = file => (fs.statSync(file).mode & 0o777).toString(8);

describe('configure-github-ssh action', () => {
  test("pins exactly GitHub's documented host key fingerprints", () => {
    const runner = newRunner();
    expect(runAction(runner).status).toBe(0);

    const fingerprints = spawnSync('ssh-keygen', ['-lf', runner.knownHosts], { encoding: 'utf8' });

    expect(fingerprints.status).toBe(0);
    expect(fingerprints.stdout.match(/SHA256:\S+/g).sort()).toEqual(
      [...documentedFingerprints].sort()
    );
    expect(fingerprints.stdout.match(/ github\.com /g)).toHaveLength(3);
  });

  test('keeps the key and host keys in RUNNER_TEMP, readable only by the user', () => {
    const runner = newRunner();
    const result = runAction(runner, 'line one\nline two');

    expect(result.status).toBe(0);
    expect(fs.readFileSync(runner.key, 'utf8')).toBe('line one\nline two\n');
    expect(fs.readdirSync(runner.ssh)).toEqual(['config']);
    expect(mode(runner.secrets)).toBe('700');
    expect(mode(runner.ssh)).toBe('700');
    for (const file of [runner.key, runner.knownHosts, runner.config]) {
      expect(mode(file)).toBe('600');
    }
  });

  test('makes ssh require the pinned keys and use only this key for github.com', () => {
    const runner = newRunner();
    expect(runAction(runner).status).toBe(0);

    const resolved = spawnSync('ssh', ['-G', '-F', runner.config, 'github.com'], {
      encoding: 'utf8',
    });
    const settings = resolved.stdout.toLowerCase();

    expect(resolved.status).toBe(0);
    expect(settings).toContain('stricthostkeychecking true');
    expect(settings).toContain('identitiesonly yes');
    expect(settings).toContain(`identityfile ${runner.key}`.toLowerCase());
    expect(settings).toContain(`userknownhostsfile ${runner.knownHosts}`.toLowerCase());
    expect(settings).toContain('globalknownhostsfile /dev/null');
  });

  test('replaces a world-readable key left by an earlier job with a 0600 one', () => {
    const runner = newRunner();
    fs.mkdirSync(runner.secrets, { recursive: true });
    fs.writeFileSync(runner.key, 'old-key\n', { mode: 0o644 });
    fs.chmodSync(runner.key, 0o644);

    const result = runAction(runner, 'new-key');

    expect(result.status).toBe(0);
    expect(fs.readFileSync(runner.key, 'utf8')).toBe('new-key\n');
    expect(mode(runner.key)).toBe('600');
  });

  test('removes the key and host keys it wrote when a later step fails', () => {
    const runner = newRunner();
    const failingBin = path.join(runner.temp, '..', 'failing-bin');
    fs.mkdirSync(failingBin);
    fs.writeFileSync(path.join(failingBin, 'mktemp'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

    const result = runAction(runner, 'secret-key', {
      PATH: `${failingBin}:${process.env.PATH}`,
    });

    expect(result.status).not.toBe(0);
    expect(fs.existsSync(runner.key)).toBe(false);
    expect(fs.existsSync(runner.knownHosts)).toBe(false);
    expect(fs.existsSync(runner.config)).toBe(false);
  });

  test.each([
    ['a global identity', 'IdentityFile ~/.ssh/broader_key\nUser deploy\n'],
    ['another github.com block', 'Host github.com\n  IdentityFile ~/.ssh/other_key\n'],
  ])('refuses an existing SSH config with %s and writes nothing', (_case, existing) => {
    const runner = newRunner();
    fs.mkdirSync(runner.ssh, { mode: 0o700 });
    fs.writeFileSync(runner.config, existing);

    const result = runAction(runner);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Existing SSH config::');
    expect(fs.readFileSync(runner.config, 'utf8')).toBe(existing);
    expect(fs.existsSync(runner.secrets)).toBe(false);
  });

  test('accepts its own config, so a job can run it more than once', () => {
    const runner = newRunner();
    expect(runAction(runner, 'first-key').status).toBe(0);

    const second = runAction(runner, 'second-key');

    expect(second.status).toBe(0);
    expect(fs.readFileSync(runner.key, 'utf8')).toBe('second-key\n');
  });

  test.each([
    ['empty', ''],
    ['whitespace-only', ' \n\t'],
  ])('fails with a clear error for an %s key and writes nothing', (_case, key) => {
    const runner = newRunner();
    const result = runAction(runner, key);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Missing SSH key::ssh-private-key is empty.');
    expect(fs.existsSync(runner.secrets)).toBe(false);
    expect(fs.existsSync(runner.ssh)).toBe(false);
  });
});
