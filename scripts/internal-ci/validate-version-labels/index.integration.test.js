const { versionLabelPrefix, untrackedLabel } = require('.');
const { parseGithubOutput } = require('../../internal-utils/test-helpers');

describe('validate-version-labels main module integration', () => {
  const fs = require('fs');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const tmp = require('os').tmpdir();
  const scriptPath = path.resolve(__dirname, 'index.js');
  const projectRoot = path.resolve(__dirname, '../../..');

  it('accepts stdin, succeeds with valid component version label, and writes correct env values', () => {
    const labelInput = `${versionLabelPrefix}a/pr-open-check/1.0.0`;
    const outputFile = path.join(tmp, 'gha_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: projectRoot,
      input: labelInput,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.hasUntrackedVersion).toBe('false');
    expect(outputs.invalidVersionLabels).toBe('');
    expect(outputs.componentVersionLabels).toBe(labelInput);
    expect(outputs.invalidComponents).toBe('');
    expect(outputs.missingChangelogs).toBe('');
    expect(outputs.isValid).toBe('true');
    expect(result.status).toBe(0);
    fs.unlinkSync(outputFile);
  });

  it('accepts the compact label for a workflow with a long component name', () => {
    const labelInput = `${versionLabelPrefix}wf/tf_validate_plan_single_root/0.0.1`;
    const outputFile = path.join(tmp, 'gha_workflow_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: projectRoot,
      input: labelInput,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.componentVersionLabels).toBe(labelInput);
    expect(outputs.validComponents).toBe('workflows/tf_validate_plan_single_root/0.0.1');
    expect(outputs.isValid).toBe('true');
    expect(result.status).toBe(0);
    fs.unlinkSync(outputFile);
  });

  it('fails when a component has more than one version label', () => {
    const labelInput = `${versionLabelPrefix}a/pr-open-check/1.0.0\n${versionLabelPrefix}a/pr-open-check/1.1.0`;
    const outputFile = path.join(tmp, 'gha_duplicate_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: projectRoot,
      input: labelInput,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.duplicateComponents).toBe('actions/pr-open-check');
    expect(outputs.validComponents).toBe('');
    expect(outputs.validationMessage).toContain('More than one version label');
    expect(outputs.isValid).toBe('false');
    expect(result.status).not.toBe(0);
    fs.unlinkSync(outputFile);
  });

  it('fails when the tag listed in RELEASED_TAGS_FILE already exists', () => {
    const labelInput = `${versionLabelPrefix}a/pr-open-check/1.0.0`;
    const releasedTagsFile = path.join(tmp, 'released_tags.txt');
    fs.writeFileSync(
      releasedTagsFile,
      'actions/pr-open-check/1.0.0\nworkflows/run_semgrep_scan/1.0.0\n',
      'utf8'
    );
    const outputFile = path.join(tmp, 'gha_released_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: projectRoot,
      input: labelInput,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile, RELEASED_TAGS_FILE: releasedTagsFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.releasedVersions).toBe('actions/pr-open-check/1.0.0');
    expect(outputs.validComponents).toBe('');
    expect(outputs.validationMessage).toContain('already released');
    expect(outputs.isValid).toBe('false');
    expect(result.status).not.toBe(0);
    fs.unlinkSync(releasedTagsFile);
    fs.unlinkSync(outputFile);
  });

  it('rejects the previous version label format', () => {
    const labelInput = 'version:actions/pr-open-check/1.0.0';
    const outputFile = path.join(tmp, 'gha_old_format_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: projectRoot,
      input: labelInput,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.componentVersionLabels).toBe('');
    expect(outputs.validationMessage).toContain('No version labels found');
    expect(outputs.isValid).toBe('false');
    expect(result.status).not.toBe(0);
    fs.unlinkSync(outputFile);
  });

  it('accepts a file argument, fails with invalid label, and writes correct env values', () => {
    const invalidComponent = `${versionLabelPrefix}a/invalid-component/1.0.0`;
    const missingChangelog = `${versionLabelPrefix}a/pr-open-check/0.0.0`;
    const invalidLabel = `${versionLabelPrefix}invalid-label`;
    const labelFile = path.join(tmp, 'labels.txt');
    fs.writeFileSync(
      labelFile,
      `${invalidLabel}\n${untrackedLabel}\n${invalidComponent}\n${missingChangelog}`,
      'utf8'
    );
    const outputFile = path.join(tmp, 'gha_output.txt');
    const result = spawnSync('node', [scriptPath, labelFile], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    // Check exit code (should fail)
    expect(result.status).not.toBe(0);
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.isValid).toBe('false');
    expect(outputs.hasUntrackedVersion).toBe('true');
    expect(outputs.invalidVersionLabels).toBe(invalidLabel);
    expect(outputs.componentVersionLabels).toContain(invalidComponent);
    expect(outputs.componentVersionLabels).toContain(missingChangelog);
    expect(outputs.invalidComponents).toBe('actions/invalid-component');
    expect(outputs.missingChangelogs).toBe('actions/pr-open-check');
    fs.unlinkSync(labelFile);
    fs.unlinkSync(outputFile);
  });
});
