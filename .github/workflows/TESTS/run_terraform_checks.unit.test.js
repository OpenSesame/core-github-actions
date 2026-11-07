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
        'resource "aws_s3_bucket" "a" {\n  #checkov:skip=CKV_AWS_19: reason\n}\n# tflint-ignore: terraform_unused_declarations\n',
      '.core-services/vendored.tf': '#checkov:skip=CKV_AWS_1: vendored\n',
    });

    expect(result.status).toBe(0);
    expect(result.outputs.count).toBe('5');
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
