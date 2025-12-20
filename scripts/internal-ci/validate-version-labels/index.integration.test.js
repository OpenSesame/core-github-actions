const { versionLabelPrefix, untrackedLabel } = require('.');

describe('validate-version-labels main module integration', () => {
  const fs = require('fs');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const tmp = require('os').tmpdir();
  const scriptPath = path.resolve(__dirname, 'index.js');
  const projectRoot = path.resolve(__dirname, '../../..');

  function parseGithubOutput(file) {
    return Object.fromEntries(
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => line.split(/=(.*)/).slice(0, 2))
    );
  }

  it('accepts stdin, succeeds with valid component version label, and writes correct env values', () => {
    const labelInput = `${versionLabelPrefix}actions/pr-open-check/1.0.0`;
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

  it('accepts a file argument, fails with invalid label, and writes correct env values', () => {
    const invalidComponent = `${versionLabelPrefix}actions/invalid-component/1.0.0`;
    const missingChangelog = `${versionLabelPrefix}actions/pr-open-check/0.0.0`;
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
