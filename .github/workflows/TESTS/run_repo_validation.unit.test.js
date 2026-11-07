const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_repo_validation.yml';

const fakeValidator = `console.log('validator args:', JSON.stringify(process.argv.slice(2)));
process.exit(Number(process.env.VALIDATOR_EXIT || 0));
`;

describe('run_repo_validation latest-release lookup', () => {
  test('skips the lookup with a notice when there is no SSH key', () => {
    const result = runStepInRepository(
      workflowFile,
      'validate',
      'Look up the latest validator release',
      {},
      { ORG_READ_ONLY_SSH_KEY: '' }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '::notice title=Repo Validation::No ORG_READ_ONLY_SSH_KEY secret'
    );
    expect(result.outputs.version).toBeUndefined();
  });

  test('bounds the lookup and never prompts', () => {
    const workflow = readWorkflow(workflowFile);

    expect(workflow).toContain('-o BatchMode=yes');
    expect(workflow).toContain('timeout 30s git ls-remote');
    expect(workflow).toMatch(/ORG_READ_ONLY_SSH_KEY:\n\s+description: .+\n\s+required: false/);
  });
});

describe('run_repo_validation validate step', () => {
  const validate = (env, files = { '.core-services/generated/validate-repo.mjs': fakeValidator }) =>
    runStepInRepository(workflowFile, 'validate', 'Validate repository', files, {
      VALIDATOR: '.core-services/generated/validate-repo.mjs',
      LATEST_VERSION: '',
      ...env,
    });

  test('passes the latest version when the lookup found one', () => {
    const result = validate({ LATEST_VERSION: '0.14.0' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validator args: ["--latest-version","0.14.0"]');
  });

  test('runs without --latest-version when the lookup found none', () => {
    const result = validate({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validator args: []');
  });

  test("fails with the validator's exit code", () => {
    const result = validate({ VALIDATOR_EXIT: '2' });

    expect(result.status).toBe(2);
  });

  test('fails with a clear error when the validator kit is missing', () => {
    const result = validate({}, { 'README.md': '# Fixture\n' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Repo Validation::.core-services/generated/validate-repo.mjs is missing.'
    );
  });
});
