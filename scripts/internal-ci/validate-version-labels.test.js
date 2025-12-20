const {
  getLabelArray,
  getVersionLabelArray,
  getInvalidVersionLabels,
  getComponentVersionLabels,
  basicValidate,
  versionLabelPrefix,
  untrackedLabel,
} = require('./validate-version-labels');

describe('getLabelArray', () => {
  it('should parse raw newline separated labels into an array', () => {
    const rawLabels = 'label1\nlabel2\nlabel3';
    const labels = getLabelArray(rawLabels);
    expect(labels).toEqual(['label1', 'label2', 'label3']);
  });
});

describe('getVersionLabelArray', () => {
  it('should filter version labels from the label array', () => {
    const labels = [
      `${versionLabelPrefix}`,
      `${untrackedLabel}`,
      'bugfix',
      `${versionLabelPrefix}abc`,
      'enhancement',
      'version',
    ];
    const versionLabels = getVersionLabelArray(labels);
    expect(versionLabels).toEqual([
      `${versionLabelPrefix}`,
      `${untrackedLabel}`,
      `${versionLabelPrefix}abc`,
    ]);
  });
});

const versionLabels = [
  `${versionLabelPrefix}`, //incomplete version label
  `${untrackedLabel}`, // valid untracked label
  `${versionLabelPrefix}valid/version:v1.0.0`, // valid label
  'invalid-label', // completely invalid label
  `${versionLabelPrefix}v1.0.0`, // missing component info
  `${versionLabelPrefix}invalid:v1.0.0`, // doesn't follow component-type/component-name format
  `${versionLabelPrefix}invalid/version`, // missing version
  `${versionLabelPrefix}invalid/version:v1.0`, // not full semver
  `${versionLabelPrefix}invalid/version:v1.0.0-extra`, // don't support build metadata
  `${versionLabelPrefix}invalid/version:1.0.0`, // missing 'v' prefix
];

describe('getInvalidVersionLabels', () => {
  it('should identify invalid version labels', () => {
    const invalidLabels = getInvalidVersionLabels(versionLabels);
    expect(invalidLabels).toEqual([
      `${versionLabelPrefix}`,
      'invalid-label',
      `${versionLabelPrefix}v1.0.0`,
      `${versionLabelPrefix}invalid:v1.0.0`,
      `${versionLabelPrefix}invalid/version`,
      `${versionLabelPrefix}invalid/version:v1.0`,
      `${versionLabelPrefix}invalid/version:v1.0.0-extra`,
      `${versionLabelPrefix}invalid/version:1.0.0`,
    ]);
  });
});

describe('getComponentVersionLabels', () => {
  it('should extract valid component version labels', () => {
    const componentLabels = getComponentVersionLabels(versionLabels);
    expect(componentLabels).toEqual([`${versionLabelPrefix}valid/version:v1.0.0`]);
  });
});

describe('basicValidate', () => {
  it('should fail when no valid labels are present', () => {
    const hasUntracked = false;
    const invalidLabels = [];
    const componentLabels = [];

    const result = basicValidate(invalidLabels, componentLabels, hasUntracked);
    expect(result.isValid).toBe(false);
    expect(result.basicValidationMessage).toContain('- No version labels');
  });

  it('should pass when only untracked label is present', () => {
    const hasUntracked = true;
    const invalidLabels = [];
    const componentLabels = [];

    const result = basicValidate(invalidLabels, componentLabels, hasUntracked);
    expect(result.isValid).toBe(true);
  });

  it('should fail when invalid labels are present', () => {
    const hasUntracked = true;
    const invalidLabels = ['invalid-label'];
    const componentLabels = ['version:valid/component-v1.0.0'];

    const result = basicValidate(invalidLabels, componentLabels, hasUntracked);
    expect(result.isValid).toBe(false);
    expect(result.basicValidationMessage).toContain('- Invalid version labels');
  });

  it('should fail when both untracked and component version labels are present', () => {
    const hasUntracked = true;
    const invalidLabels = [];
    const componentLabels = ['version:valid/component-v1.0.0'];

    const result = basicValidate(invalidLabels, componentLabels, hasUntracked);
    expect(result.isValid).toBe(false);
    expect(result.basicValidationMessage).toContain('- Conflicting version labels');
  });

  it('should pass when only valid component version labels are present', () => {
    const invalidLabels = [];
    const componentLabels = ['version:valid/component-v1.0.0'];
    const hasUntracked = false;

    const result = basicValidate(invalidLabels, componentLabels, hasUntracked);
    expect(result.isValid).toBe(true);
    expect(result.basicValidationMessage).toBe('');
  });
});

describe('main module integration', () => {
  const fs = require('fs');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const tmp = require('os').tmpdir();
  const scriptPath = path.resolve(__dirname, 'validate-version-labels.js');

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
    const labelInput = `${versionLabelPrefix}valid/component:v1.2.3`;
    const outputFile = path.join(tmp, 'gha_output.txt');
    const result = spawnSync('node', [scriptPath], {
      cwd: tmp,
      input: labelInput,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    // Check exit code
    expect(result.status).toBe(0);
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.isValid).toBe('true');
    expect(outputs.invalidVersionLabels).toBe('');
    expect(outputs.componentVersionLabels).toBe(labelInput);
    expect(outputs.hasUntrackedVersion).toBe('false');
    fs.unlinkSync(outputFile);
  });

  it('accepts a file argument, fails with invalid label, and writes correct env values', () => {
    const validLabel = `${versionLabelPrefix}valid/component:v1.2.3`;
    const invalidLabel = `${versionLabelPrefix}invalid-label`;
    const labelFile = path.join(tmp, 'labels.txt');
    fs.writeFileSync(labelFile, `${invalidLabel}\n${untrackedLabel}\n${validLabel}`, 'utf8');
    const outputFile = path.join(tmp, 'gha_output.txt');
    const result = spawnSync('node', [scriptPath, labelFile], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    // Check exit code (should fail)
    expect(result.status).not.toBe(0);
    const outputs = parseGithubOutput(outputFile);
    expect(outputs.isValid).toBe('false');
    expect(outputs.hasUntrackedVersion).toBe('true');
    expect(outputs.componentVersionLabels).toBe(validLabel);
    expect(outputs.invalidVersionLabels).toBe(invalidLabel);
    fs.unlinkSync(labelFile);
    fs.unlinkSync(outputFile);
  });
});
