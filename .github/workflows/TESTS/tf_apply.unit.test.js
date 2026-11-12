const { readWorkflow } = require('./workflow-test-helpers');

const concurrency = workflowFile => {
  const block = readWorkflow(workflowFile).match(/^concurrency:\n((?: {2}.*\n)+)/m);
  if (!block) {
    throw new Error(`No workflow-level concurrency block in ${workflowFile}`);
  }
  return block[1];
};

describe('Terraform apply concurrency', () => {
  test('tf_apply locks one Terraform state: repository, environment, root, and workspace', () => {
    const block = concurrency('tf_apply.yml');

    expect(block).toContain(
      'group: core-gha-tf-apply-${{ github.repository }}-${{ inputs.environment }}-${{ inputs.terraform-root }}-${{ inputs.terraform-workspace }}'
    );
    expect(block).not.toContain('cancel-in-progress');
  });

  test('tf_apply waits for a state lock held by another run', () => {
    expect(readWorkflow('tf_apply.yml')).toContain(
      'run: terraform apply -auto-approve -input=false -lock-timeout=5m'
    );
  });

  test('deploy_thru_prod locks its roots and workspace and calls tf_apply directly', () => {
    const workflow = readWorkflow('deploy_thru_prod.yml');
    const block = concurrency('deploy_thru_prod.yml');

    expect(block).toMatch(/group: core-gha-deploy-thru-prod-\$\{\{ github\.repository \}\}-/);
    for (const input of [
      'terraform-root-dev',
      'terraform-root-stage',
      'terraform-root-prod',
      'terraform-workspace',
    ]) {
      expect(block).toContain(`inputs.${input}`);
    }
    expect(block).not.toContain('cancel-in-progress');
    expect(workflow.match(/uses: \.\/\.github\/workflows\/tf_apply\.yml/g)).toHaveLength(3);
    expect(workflow).not.toContain('deploy_environment.yml');
  });
});
