const { readWorkflow, runStepInRepository } = require('./workflow-test-helpers');

const workflowFile = 'run_terraform_checks.yml';

const baseline = checkIds =>
  JSON.stringify({
    failed_checks: [
      { file: '/main.tf', findings: [{ resource: 'aws_s3_bucket.a', check_ids: checkIds }] },
    ],
  });

describe('run_terraform_checks baselined count', () => {
  const count = files =>
    runStepInRepository(workflowFile, 'checks', 'Count baselined issues', files);

  test('adds Checkov baseline findings to inline checkov and tflint ignores', () => {
    const result = count({
      'terraform/.checkov.baseline': baseline(['CKV_AWS_18', 'CKV_AWS_144']),
      'terraform/modules/x/.checkov.baseline': baseline(['CKV_AWS_21']),
      'terraform/main.tf':
        'resource "aws_s3_bucket" "a" {\n  #checkov:skip=CKV_AWS_19: reason\n  # checkov:skip=CKV_AWS_20: reason\n}\n# tflint-ignore: terraform_unused_declarations\n// tflint-ignore-file: terraform_naming_convention\n',
      '.core-services/vendored.tf': '#checkov:skip=CKV_AWS_1: vendored\n',
      'README.md': '#checkov:skip=CKV_AWS_19: documented\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('7');
  });

  test("reports zero without a baseline or inline ignores, and doesn't count its own patterns", () => {
    const result = count({
      'terraform/main.tf': 'terraform {}\n',
      [`.github/workflows/${workflowFile}`]: readWorkflow(workflowFile),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No Checkov baseline');
    expect(result.outputs.count).toBe('0');
  });
});

describe('run_terraform_checks SSH key lifetime', () => {
  const workflow = readWorkflow(workflowFile);
  const step = name => workflow.indexOf(`      - name: ${name}`);

  test('sets up SSH only when the secret is set, and only for Initialize', () => {
    const configure = step('Configure GitHub SSH credentials');
    const init = step('Initialize');

    expect(configure).toBeGreaterThan(step('Set up mise'));
    expect(init).toBeGreaterThan(configure);
    expect(workflow.slice(configure, init)).toContain(
      "if: ${{ env.HAS_ORG_READ_ONLY_SSH_KEY == 'true' }}"
    );
    expect(workflow.slice(init, step('Validate'))).toContain("steps.ssh.outcome != 'failure'");
  });

  test('removes the SSH key after Initialize and before Validate, Lint and Scan run', () => {
    const init = step('Initialize');
    const cleanup = step('Remove GitHub SSH credentials');
    const validate = step('Validate');

    expect(cleanup).toBeGreaterThan(init);
    expect(validate).toBeGreaterThan(cleanup);
    expect(step('Lint')).toBeGreaterThan(cleanup);
    expect(step('Scan')).toBeGreaterThan(cleanup);
    expect(workflow.slice(cleanup, validate)).toContain(
      "if: ${{ always() && steps.ssh.outcome == 'success' }}"
    );
    expect(workflow.slice(cleanup, validate)).toContain(
      'rm -rf "$RUNNER_TEMP/configure-github-ssh" ~/.ssh/config'
    );
  });
});
