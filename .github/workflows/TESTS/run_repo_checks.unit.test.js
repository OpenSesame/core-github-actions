const fs = require('node:fs');
const path = require('node:path');
const {
  createRepository,
  extractRunScript,
  readWorkflow,
  runScript,
} = require('./workflow-test-helpers');

const workflowFile = 'run_repo_checks.yml';

function detect(files, { untracked = {} } = {}) {
  const repository = createRepository(files);
  for (const [filePath, contents] of Object.entries(untracked)) {
    fs.mkdirSync(path.dirname(path.join(repository, filePath)), { recursive: true });
    fs.writeFileSync(path.join(repository, filePath), contents);
  }
  try {
    return runScript(extractRunScript(workflowFile, 'detect', 'Detect technologies'), {
      cwd: repository,
    });
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

function summarize(needs) {
  return runScript(extractRunScript(workflowFile, 'summary', 'Write job summary'), {
    env: { NEEDS_JSON: JSON.stringify(needs) },
  });
}

describe('run_repo_checks Detect', () => {
  test('counts each technology from tracked files', () => {
    const result = detect({
      '.github/workflows/ci.yml': 'on: push\n',
      '.github/workflows/nested/not-a-workflow.yml': 'on: push\n',
      '.github/actions/thing/action.yaml': 'runs: {}\n',
      '.github/dependabot.yml': 'version: 2\n',
      'terraform/main.tf': 'terraform {}\n',
      'terraform/variables.tf': '',
      'README.md': '# Fixture\n',
      'scripts/a.sh': 'echo a\n',
      'scripts/b.bash': 'echo b\n',
      'scripts/c.zsh': 'echo c\n',
      'bin/tool': '#!/usr/bin/env bash\necho tool\n',
      'bin/legacy': '#!/bin/sh\necho legacy\n',
      'bin/local': '#! /usr/local/bin/zsh -f\necho local\n',
      'bin/python-tool': '#!/usr/bin/env python3\nprint(1)\n',
      'bin/bashful': '#!/usr/bin/env bashful\n',
      'src/index.js': '',
      'src/types.d.ts': '',
      'src/view.tsx': '',
      'eslint.config.mjs': '',
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({
      'gha-files': '2',
      'terraform-files': '2',
      'markdown-files': '1',
      'shell-files': '6',
      'js-files': '4',
    });
  });

  test('ignores untracked files and generated or vendored directories', () => {
    const result = detect(
      {
        '.core-services/generated/validate-repo.mjs': '',
        '.core-services/standard.md': '',
        '.core-services/hooks/check.sh': '',
        'node_modules/pkg/index.js': '',
        'packages/app/node_modules/pkg/index.js': '',
        'terraform/.terraform/modules/x/main.tf': '',
        'dist/bundle.js': '',
        'build/out.js': '',
        'coverage/lcov.js': '',
        'vendor/lib.sh': '',
      },
      { untracked: { 'scratch.md': '', 'run.sh': '', '.github/workflows/local.yml': '' } }
    );

    expect(result.status).toBe(0);
    expect(result.outputs).toEqual({
      'gha-files': '0',
      'terraform-files': '0',
      'markdown-files': '0',
      'shell-files': '0',
      'js-files': '0',
    });
  });

  test('handles file names with spaces and lists each technology in a log group', () => {
    const result = detect({ 'docs/release notes.md': '', 'my script.sh': '' });

    expect(result.status).toBe(0);
    expect(result.outputs['markdown-files']).toBe('1');
    expect(result.outputs['shell-files']).toBe('1');
    expect(result.stdout).toContain(
      '::group::markdown: 1 files\ndocs/release notes.md\n::endgroup::'
    );
    expect(result.stdout).toContain('::group::gha: 0 files\n::endgroup::');
  });
});

describe('run_repo_checks Summary', () => {
  const detected = files => ({
    result: 'success',
    outputs: {
      'gha-files': '0',
      'terraform-files': '0',
      'markdown-files': '0',
      'shell-files': '0',
      'js-files': '0',
      ...files,
    },
  });
  const skipped = { result: 'skipped', outputs: {} };

  test('shows absent technologies as not present and present ones by step outcome', () => {
    const result = summarize({
      detect: detected({ 'terraform-files': '12', 'markdown-files': '3' }),
      gha: skipped,
      terraform: {
        result: 'failure',
        outputs: {
          init: 'failure',
          validate: 'skipped',
          lint: 'success',
          format: 'failure',
          scan: 'success',
          baselined: '4',
        },
      },
      markdown: { result: 'success', outputs: { lint: 'success', baselined: '0' } },
      shell: skipped,
      js: skipped,
      standard: { result: 'success', outputs: { result: 'success' } },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toContain(
      '| Technology | Files | Init | Validate | Lint | Format | Scan | Baselined |'
    );
    expect(result.summary).toContain(
      '| GitHub Actions | 0 | — | — | ⏭️ not present | — | ⏭️ not present | — |'
    );
    expect(result.summary).toContain(
      '| Terraform | 12 | ❌ fail | ⏭️ skipped | ✅ pass | ❌ fail | ✅ pass | 4 |'
    );
    expect(result.summary).toContain('| Markdown | 3 | — | — | ✅ pass | — | — | 0 |');
    expect(result.summary).toContain('**Standard:** ✅ pass');
  });

  test('falls back to the job result when a job failed before its steps ran', () => {
    const result = summarize({
      detect: detected({ 'shell-files': '2' }),
      gha: skipped,
      terraform: skipped,
      markdown: skipped,
      shell: { result: 'failure', outputs: { lint: '', format: '', baselined: '' } },
      js: skipped,
      standard: { result: 'failure', outputs: {} },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toContain('| Shell | 2 | — | — | ❌ fail | ❌ fail | — | ? |');
    expect(result.summary).toContain('**Standard:** ❌ fail');
  });

  test('shows a setup failure when a failed job skipped steps without a failing one', () => {
    const result = summarize({
      detect: detected({ 'markdown-files': '74', 'js-files': '27', 'terraform-files': '3' }),
      gha: skipped,
      terraform: {
        result: 'failure',
        outputs: {
          init: 'skipped',
          validate: 'skipped',
          lint: 'skipped',
          format: 'skipped',
          scan: 'skipped',
          baselined: '0',
        },
      },
      markdown: { result: 'failure', outputs: { lint: 'skipped', baselined: '0' } },
      shell: skipped,
      js: { result: 'failure', outputs: { lint: 'skipped', format: 'skipped', baselined: '0' } },
      standard: { result: 'success', outputs: { result: 'success' } },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toContain(
      '| Terraform | 3 | ❌ setup failed | ❌ setup failed | ❌ setup failed | ❌ setup failed | ❌ setup failed | 0 |'
    );
    expect(result.summary).toContain('| Markdown | 74 | — | — | ❌ setup failed | — | — | 0 |');
    expect(result.summary).toContain(
      '| JavaScript/TypeScript | 27 | — | — | ❌ setup failed | ❌ setup failed | — | 0 |'
    );
  });

  test('marks every technology unknown when Detect failed', () => {
    const result = summarize({
      detect: { result: 'failure', outputs: {} },
      gha: skipped,
      terraform: skipped,
      markdown: skipped,
      shell: skipped,
      js: skipped,
      standard: { result: 'success', outputs: { result: 'success' } },
    });

    expect(result.status).toBe(0);
    expect(result.summary).toContain(
      '| Terraform | ? | ⏭️ skipped | ⏭️ skipped | ⏭️ skipped | ⏭️ skipped | ⏭️ skipped | ? |'
    );
  });
});

describe('run_repo_checks secrets', () => {
  test('passes ORG_READ_ONLY_SSH_KEY to the Terraform job', () => {
    const workflow = readWorkflow(workflowFile);
    const terraform = workflow.indexOf('  terraform:');
    const markdown = workflow.indexOf('  markdown:');

    expect(terraform).toBeGreaterThan(-1);
    expect(markdown).toBeGreaterThan(terraform);
    expect(workflow.slice(terraform, markdown)).toContain(
      'ORG_READ_ONLY_SSH_KEY: ${{ secrets.ORG_READ_ONLY_SSH_KEY }}'
    );
  });
});
