const fs = require('node:fs');
const path = require('node:path');
const { createRepository, extractRunScript, runScript } = require('./workflow-test-helpers');

const script = extractRunScript(
  'tf_plan_single_root.yml',
  'plan',
  'Detect build artifact directories'
);
const createScript = extractRunScript(
  'tf_plan_single_root.yml',
  'plan',
  'Create build artifact directories'
);

const gitignore = 'dist\n.terraform\n';
const placeholder = '.terraform-plan-placeholder';

function modulesJson(...dirs) {
  return JSON.stringify({
    Modules: [
      { Key: '', Source: '', Dir: '.' },
      ...dirs.map(dir => ({ Key: path.basename(dir), Source: dir, Dir: dir })),
    ],
  });
}

function detectAndCheck(files, paths = [], { step = script, env } = {}) {
  const repository = createRepository({ '.gitignore': gitignore, ...files });
  try {
    const result = runScript(step, { cwd: path.join(repository, 'terraform/dev'), env });
    return {
      ...result,
      created: paths.filter(file => fs.existsSync(path.join(repository, file))),
    };
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

describe('tf_plan_single_root Detect build artifact directories', () => {
  test('creates git-ignored directories referenced by the root and nested local modules', () => {
    const result = detectAndCheck(
      {
        'terraform/dev/main.tf': [
          'module "common" { source = "../modules/common" }',
          'output "a" { value = "${path.root}/../../lambdas/a/dist" }',
          'output "cwd" { value = "${path.cwd}/../../lambdas/cwd/dist" }',
        ].join('\n'),
        'terraform/dev/.terraform/modules/modules.json': modulesJson(
          '../modules/common',
          '../modules/common/inner'
        ),
        'terraform/modules/common/main.tf': [
          'module "inner" { source = "./inner" }',
          'module "lambda" {',
          '  source      = "terraform-aws-modules/lambda/aws"',
          '  source_path = "${path.module}/../../../lambdas/b/dist/out-tsc"',
          '}',
        ].join('\n'),
        'terraform/modules/common/inner/main.tf': [
          'locals {',
          '  source_path = [{',
          '    path             = "${path.module}/../../../../lambdas/c/dist"',
          '    npm_requirements = false',
          '  }]',
          '}',
        ].join('\n'),
      },
      ['lambdas/a/dist', 'lambdas/cwd/dist', 'lambdas/b/dist/out-tsc', 'lambdas/c/dist']
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.created).toEqual([
      'lambdas/a/dist',
      'lambdas/cwd/dist',
      'lambdas/b/dist/out-tsc',
      'lambdas/c/dist',
    ]);
    expect(result.stdout).toContain('Creating: [lambdas/b/dist/out-tsc]');
    expect(result.stdout).toContain('Created 4 build artifact directories');
    expect(result.stdout).not.toContain('::');
  });

  test('skips remote modules and, without modules.json, local modules', () => {
    const remote = detectAndCheck(
      {
        'terraform/dev/main.tf': 'module "remote" { source = "example/remote/aws" }\n',
        'terraform/dev/.terraform/modules/modules.json': modulesJson('.terraform/modules/remote'),
        'terraform/dev/.terraform/modules/remote/main.tf':
          'output "x" { value = "${path.module}/dist" }\n',
      },
      ['terraform/dev/.terraform/modules/remote/dist']
    );
    const local = detectAndCheck(
      {
        'terraform/dev/main.tf': 'module "common" { source = "../modules/common" }\n',
        'terraform/modules/common/main.tf':
          'output "x" { value = "${path.module}/../../../lambdas/b/dist" }\n',
      },
      ['lambdas/b/dist']
    );

    for (const result of [remote, local]) {
      expect(result.status).toBe(0);
      expect(result.created).toEqual([]);
      expect(result.stdout).toContain('Created 0 build artifact directories');
      expect(result.stdout).not.toContain('::');
    }
  });

  test('puts a placeholder file in each created directory, so archive_file can zip it', () => {
    const result = detectAndCheck(
      {
        'terraform/dev/main.tf': [
          'data "archive_file" "lambda" {',
          '  type        = "zip"',
          '  source_dir  = "${path.module}/../../lambdas/a/dist"',
          '  output_path = "${path.module}/dist/a.zip"',
          '}',
        ].join('\n'),
      },
      [`lambdas/a/dist/${placeholder}`, 'terraform/dev/dist']
    );

    expect(result.status).toBe(0);
    expect(result.created).toEqual([`lambdas/a/dist/${placeholder}`]);
    expect(result.stdout).toContain('Created 1 build artifact directories');
    expect(result.stdout).not.toContain('::');
  });

  test('leaves existing paths, commented lines and fileexists() arguments alone', () => {
    const result = detectAndCheck(
      {
        'lambdas/a/assets/logo.png': 'png',
        'lambdas/a/src/schema/1.sql': 'select 1;',
        'terraform/dev/main.tf': [
          'output "logo" { value = filemd5("${path.module}/../../lambdas/a/assets/logo.png") }',
          'output "sql" { value = "${path.module}/../../lambdas/a/src/schema/${each.value}" }',
          '# output "old" { value = "${path.module}/../../lambdas/old/dist" }',
          '  // output "old" { value = "${path.module}/../../lambdas/old2/dist" }',
          'output "e" { value = fileexists("${path.module}/../../lambdas/a/dist") }',
        ].join('\n'),
      },
      ['lambdas/old/dist', 'lambdas/old2/dist', 'lambdas/a/dist']
    );

    expect(result.status).toBe(0);
    expect(result.created).toEqual([]);
    expect(result.stdout).toBe('Created 0 build artifact directories\n');
  });

  test.each([
    [
      'missing paths that git does not ignore',
      '"${path.module}/../../lambdas/a/build"',
      'lambdas/a/build',
      "::notice::Not created: lambdas/a/build is missing, but git doesn't ignore it",
    ],
    [
      'paths that look like files',
      'filemd5("${path.module}/../../lambdas/a/dist/index.js")',
      'lambdas/a/dist',
      '::warning::Not created: lambdas/a/dist/index.js looks like a file',
    ],
    [
      'paths that depend on other values',
      '"${path.module}/../../lambdas/${var.name}/dist"',
      'lambdas',
      '::notice::Not created: ./../../lambdas/${var.name}/dist depends on other values',
    ],
    [
      'paths outside the repository',
      '"${path.root}/../../../outside/dist"',
      '../outside',
      '::notice::Not created: ./../../../outside/dist is outside the repository',
    ],
  ])('reports and does not create %s', (_case, expression, notCreated, message) => {
    const result = detectAndCheck(
      { 'terraform/dev/main.tf': `output "x" { value = ${expression} }\n` },
      [notCreated]
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.created).toEqual([]);
    expect(result.stdout).toContain(message);
    expect(result.stdout).toContain('Created 0 build artifact directories');
  });

  test('creates each directory once when several modules reference it', () => {
    const result = detectAndCheck({
      'terraform/dev/main.tf': [
        'output "a" { value = "${path.module}/../../lambdas/a/dist" }',
        'output "b" { value = "${path.root}/../../lambdas/a/dist" }',
        'output "c" { value = "${path.module}/../../lambdas/a/../a/dist" }',
      ].join('\n'),
    });

    expect(result.status).toBe(0);
    expect(result.stdout.match(/Creating: \[lambdas\/a\/dist\]/g)).toHaveLength(1);
    expect(result.stdout).toContain('Created 1 build artifact directories');
  });
});

describe('tf_plan_single_root Create build artifact directories', () => {
  test('creates the listed directories with a placeholder only when they are empty', () => {
    const result = detectAndCheck(
      {
        'lambdas/built/dist/index.js': 'exports.handler = () => {};',
        'terraform/dev/main.tf': '',
      },
      [
        `lambdas/a/dist/${placeholder}`,
        `lambdas/b/dist/${placeholder}`,
        'lambdas/built/dist/index.js',
        `lambdas/built/dist/${placeholder}`,
      ],
      {
        step: createScript,
        env: {
          BUILD_ARTIFACT_DIRECTORY:
            '../../lambdas/a/dist\r\n\n  ../../lambdas/b/dist  \n../../lambdas/built/dist\n',
        },
      }
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.created).toEqual([
      `lambdas/a/dist/${placeholder}`,
      `lambdas/b/dist/${placeholder}`,
      'lambdas/built/dist/index.js',
    ]);
  });
});
