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
});
