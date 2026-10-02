const { versionLabelPrefix, untrackedLabel } = require('../validate-version-labels/.');
const { parseGithubOutput } = require('../../internal-utils/test-helpers');

describe('get-version-tags main module integration', () => {
  const fs = require('fs');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const tmp = require('os').tmpdir();
  const scriptPath = path.resolve(__dirname, 'index.js');
  const projectRoot = path.resolve(__dirname, '../../..');

  it('outputs correct values when untracked label is provided', () => {
    const labelInput = `${untrackedLabel}`;
    const unique = Date.now() + Math.random();
    const labelFile = path.join(tmp, `labels-${unique}.txt`);
    const outputFile = path.join(tmp, `gha_output-${unique}.txt`);
    fs.writeFileSync(labelFile, labelInput, 'utf8');
    const result = spawnSync('node', [scriptPath, labelFile], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.hasUntracked).toBe('true');
    expect(outputs.componentTags).toBe('');
    expect(result.status).toBe(0);
    fs.unlinkSync(labelFile);
    fs.unlinkSync(outputFile);
  });

  it('expands compact component version labels into canonical tags', () => {
    const actionLabel = `${versionLabelPrefix}a/pr-open-check/1.0.0`;
    const workflowLabel = `${versionLabelPrefix}wf/tf_validate_plan_single_root/0.0.1`;
    const labelInput = `${actionLabel}\n${workflowLabel}`;
    const unique = Date.now() + Math.random();
    const labelFile = path.join(tmp, `labels-${unique}.txt`);
    const outputFile = path.join(tmp, `gha_output-${unique}.txt`);
    fs.writeFileSync(labelFile, labelInput, 'utf8');
    const result = spawnSync('node', [scriptPath, labelFile], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.hasUntracked).toBe('false');
    expect(outputs.componentTags).toBe(
      'actions/pr-open-check/1.0.0,workflows/tf_validate_plan_single_root/0.0.1'
    );
    expect(result.status).toBe(0);
    fs.unlinkSync(labelFile);
    fs.unlinkSync(outputFile);
  });
});
