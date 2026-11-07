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

function runAction({ key = 'fake-private-key', existingConfig } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'configure-github-ssh-'));
  if (existingConfig !== undefined) {
    fs.mkdirSync(path.join(home, '.ssh'), { mode: 0o700 });
    fs.writeFileSync(path.join(home, '.ssh', 'config'), existingConfig);
  }

  const result = spawnSync('bash', ['--noprofile', '--norc', '-c', extractRunScript()], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      SSH_PRIVATE_KEY: key,
      GITHUB_KNOWN_HOSTS: extractKnownHosts(),
    },
  });

  const ssh = path.join(home, '.ssh');
  const read = file => fs.readFileSync(path.join(ssh, file), 'utf8');
  const mode = file => (fs.statSync(path.join(ssh, file)).mode & 0o777).toString(8);

  return { ...result, home, ssh, read, mode };
}

const cleanups = [];
afterEach(() => {
  while (cleanups.length > 0) {
    fs.rmSync(cleanups.pop(), { recursive: true, force: true });
  }
});

function run(options) {
  const result = runAction(options);
  cleanups.push(result.home);
  return result;
}

describe('configure-github-ssh action', () => {
  test("pins exactly GitHub's documented host key fingerprints", () => {
    const result = run();
    const fingerprints = spawnSync(
      'ssh-keygen',
      ['-lf', path.join(result.ssh, 'github_known_hosts')],
      {
        encoding: 'utf8',
      }
    );

    expect(fingerprints.status).toBe(0);
    const found = fingerprints.stdout.match(/SHA256:\S+/g);
    expect(found.sort()).toEqual([...documentedFingerprints].sort());
    expect(fingerprints.stdout.match(/ github\.com /g)).toHaveLength(3);
  });

  test('writes the key, host keys and config readable only by the user', () => {
    const result = run({ key: 'line one\nline two' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Configured SSH for github.com');
    expect(result.read('github_read_only_key')).toBe('line one\nline two\n');
    expect((fs.statSync(result.ssh).mode & 0o777).toString(8)).toBe('700');
    for (const file of ['github_read_only_key', 'github_known_hosts', 'config']) {
      expect(result.mode(file)).toBe('600');
    }
  });

  test('makes ssh require the pinned keys and use only this key for github.com', () => {
    const result = run();
    const resolved = spawnSync('ssh', ['-G', '-F', path.join(result.ssh, 'config'), 'github.com'], {
      encoding: 'utf8',
    });

    expect(resolved.status).toBe(0);
    const settings = resolved.stdout.toLowerCase();
    expect(settings).toContain('stricthostkeychecking true');
    expect(settings).toContain('identitiesonly yes');
    expect(settings).toContain(
      `identityfile ${path.join(result.ssh, 'github_read_only_key')}`.toLowerCase()
    );
    expect(settings).toContain(
      `userknownhostsfile ${path.join(result.ssh, 'github_known_hosts')}`.toLowerCase()
    );
    expect(settings).toContain('globalknownhostsfile /dev/null');
  });

  test.each([
    ['a global identity', 'IdentityFile ~/.ssh/broader_key\nUser deploy\n'],
    ['another github.com block', 'Host github.com\n  IdentityFile ~/.ssh/other_key\n'],
  ])('refuses an existing SSH config with %s and writes nothing', (_case, existing) => {
    const result = run({ existingConfig: existing });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Existing SSH config::');
    expect(result.read('config')).toBe(existing);
    expect(fs.existsSync(path.join(result.ssh, 'github_read_only_key'))).toBe(false);
    expect(fs.existsSync(path.join(result.ssh, 'github_known_hosts'))).toBe(false);
  });

  test('accepts its own config, so a job can run it more than once', () => {
    const first = run();
    const second = spawnSync('bash', ['--noprofile', '--norc', '-c', extractRunScript()], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: first.home,
        SSH_PRIVATE_KEY: 'second-key',
        GITHUB_KNOWN_HOSTS: extractKnownHosts(),
      },
    });

    expect(second.status).toBe(0);
    expect(first.read('github_read_only_key')).toBe('second-key\n');
  });

  test.each([
    ['empty', ''],
    ['whitespace-only', ' \n\t'],
  ])('fails with a clear error for an %s key', (_case, key) => {
    const result = run({ key });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error title=Missing SSH key::ssh-private-key is empty.');
    expect(fs.existsSync(path.join(result.ssh, 'github_read_only_key'))).toBe(false);
  });
});
