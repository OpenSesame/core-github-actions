const fs = require('node:fs');
const path = require('node:path');
const { readWorkflow } = require('./workflow-test-helpers');

const workflowFile = 'detect_deployable_changes.yml';
const actionFile = path.join(
  __dirname,
  '..',
  '..',
  'actions',
  'detect-deployable-changes',
  'action.yml'
);

// Top-level keys of a two-space-indented YAML block, such as an action's inputs.
const blockKeys = (text, block, indent) => {
  const lines = text.split('\n');
  const start = lines.indexOf(block);
  if (start === -1) throw new Error(`Unable to find ${block.trim()}`);
  const keys = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && !line.startsWith(' '.repeat(indent))) break;
    const match = line.match(new RegExp(`^ {${indent}}([a-z-]+):`));
    if (match) keys.push(match[1]);
  }
  return keys;
};

describe('detect_deployable_changes', () => {
  const workflow = readWorkflow(workflowFile);
  const action = fs.readFileSync(actionFile, 'utf8');
  const actionInputs = blockKeys(action, 'inputs:', 2);

  test("declares and passes every action input except the token, which defaults to the job's", () => {
    const passedInputs = actionInputs.filter(input => input !== 'github-token');
    const workflowInputs = blockKeys(workflow, '    inputs:', 6);

    expect(actionInputs).toContain('github-token');
    expect(workflowInputs).toEqual([...passedInputs, 'timeout-minutes']);
    for (const input of passedInputs) {
      expect(workflow).toContain(`          ${input}: \${{ inputs.${input} }}\n`);
    }
  });

  test("exposes every action output as the workflow's output", () => {
    const actionOutputs = blockKeys(action, 'outputs:', 2);
    expect(actionOutputs).toEqual(['should-deploy', 'reason', 'verified-sha']);
    for (const output of actionOutputs) {
      expect(workflow).toContain(`        value: \${{ jobs.detect.outputs.${output} }}\n`);
      expect(workflow).toContain(`      ${output}: \${{ steps.detect.outputs.${output} }}\n`);
    }
  });

  test('pins the action to a released commit', () => {
    expect(workflow).toMatch(
      /uses: OpenSesame\/core-github-actions\/\.github\/actions\/detect-deployable-changes@[0-9a-f]{40} # actions\/detect-deployable-changes\/\d+\.\d+\.\d+\n/
    );
  });

  test('checks out full history without keeping credentials', () => {
    expect(workflow).toContain('          fetch-depth: 0\n');
    expect(workflow).toContain('          persist-credentials: false\n');
  });

  test('grants only read access to Actions runs and contents', () => {
    expect(workflow).toContain('\npermissions: {}\n');
    expect(workflow).toContain(
      '    permissions:\n      actions: read # Required to read earlier deploy runs and their jobs.\n      contents: read # Required to check out the history the changes are diffed against.\n    timeout-minutes'
    );
  });

  test('times out after the action stops waiting', () => {
    const number = name =>
      Number(
        workflow.match(new RegExp(`      ${name}:\\n(?:        .*\\n)*?        default: (\\d+)`))[1]
      );
    expect(number('timeout-minutes')).toBeGreaterThan(number('wait-timeout-minutes'));
  });
});
