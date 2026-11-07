const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_repo_validation.yml';

const fakeValidator = `console.log('validator args:', JSON.stringify(process.argv.slice(2)));
process.exit(Number(process.env.VALIDATOR_EXIT || 0));
`;

describe('run_repo_validation latest-release lookup', () => {
  const lookup = sshSetup =>
    runStepInRepository(
      workflowFile,
      'validate',
      'Look up the latest validator release',
      {},
      { SSH_SETUP: sshSetup }
    );

  test('skips the lookup with a notice when there is no SSH key', () => {
    const result = lookup('skipped');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '::notice title=Repo Validation::No ORG_READ_ONLY_SSH_KEY secret'
    );
    expect(result.outputs.version).toBeUndefined();
  });

  test('warns and validates without a version when SSH setup failed', () => {
    const result = lookup('failure');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '::warning title=Repo Validation::Could not configure SSH to look up the latest validator release.'
    );
    expect(result.outputs.version).toBeUndefined();
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

describe('run_repo_validation SSH key lifetime', () => {
  test('removes the SSH key after the lookup and before the repository validator runs', () => {
    const workflow = readWorkflow(workflowFile);
    const lookup = workflow.indexOf('      - name: Look up the latest validator release');
    const cleanup = workflow.indexOf('      - name: Remove GitHub SSH credentials');
    const validate = workflow.indexOf('      - name: Validate repository');

    expect(lookup).toBeGreaterThan(-1);
    expect(cleanup).toBeGreaterThan(lookup);
    expect(validate).toBeGreaterThan(cleanup);
    expect(workflow.slice(cleanup, validate)).toContain(
      "if: ${{ always() && steps.ssh.outcome == 'success' }}"
    );
    expect(workflow.slice(cleanup, validate)).toContain(
      'rm -rf "$RUNNER_TEMP/configure-github-ssh"'
    );
  });
});
