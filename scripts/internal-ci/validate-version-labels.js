// validate-version-labels.js
// Script to validate version labels for CI workflows
//
// Usage:
//   node validate-version-labels.js <labels-file>
//   echo -e "version:type/foo:v1.2.3\nversion:type/bar:v2.0.0\nother" | node scripts/internal-ci/validate-version-labels.js
//
// Inputs:
//   - Newline-separated list of label strings (from file or stdin)
//
// Outputs:
//   - Writes to $GITHUB_OUTPUT variable:
//       isValid: true/false
//       validationMessage: detailed message of validation errors
//       invalidVersionLabels: comma-separated list of invalid version labels
//       hasUntrackedVersion: true/false if untracked version label is present
//       componentVersionLabels: comma-separated list of valid component version labels
//   - Exits with code 1 on validation failure, 0 on success

const fs = require('fs');

// Returns an array of normalized, trimmed, non-empty label strings
function getLabelArray(rawLabels) {
  return rawLabels
    .split('\n')
    .map(l => l.trim().toLowerCase())
    .filter(Boolean);
}

const versionLabelPrefix = 'version:';
const untrackedLabel = `${versionLabelPrefix}untracked`; // Special label for untracked versions, 'version:untracked'
const semverPattern = 'v\\d+\\.\\d+\\.\\d+'; // Semantic versioning pattern vX.Y.Z, e.g., v1.2.3
// Pattern for valid version label: version:component-type/component-name:vX.Y.Z where type and name correspond to the path of the component under the ./github directory
const componentVersionRegEx = new RegExp(
  `^${versionLabelPrefix}[a-z0-9_-]+\/[a-z0-9_-]+:${semverPattern}$`
);

function getVersionLabelArray(labels) {
  return labels.filter(label => label.startsWith(versionLabelPrefix));
}

function getInvalidVersionLabels(versionLabels) {
  return versionLabels.filter(
    label => label !== untrackedLabel && !componentVersionRegEx.test(label)
  );
}

function getComponentVersionLabels(versionLabels) {
  return versionLabels.filter(label => componentVersionRegEx.test(label));
}

function basicValidate(invalidVersionLabels, componentVersionLabels, hasUntrackedVersion) {
  const hasVersionLabels =
    invalidVersionLabels.length + componentVersionLabels.length + (hasUntrackedVersion ? 1 : 0) > 0;
  const hasInvalidVersionLabels = invalidVersionLabels.length > 0;
  const hasConflictingVersions = hasUntrackedVersion && componentVersionLabels.length > 0;

  let basicValidationMessage = '';
  if (!hasVersionLabels) {
    basicValidationMessage = '- No version labels found. At least one version label is required.';
  }
  if (hasInvalidVersionLabels) {
    basicValidationMessage += '- Invalid version labels found.\n';
  }
  if (hasConflictingVersions) {
    basicValidationMessage +=
      '- Conflicting version labels found: both untracked and component version labels present.\n';
  }

  return {
    isValid: hasVersionLabels && !hasInvalidVersionLabels && !hasConflictingVersions,
    basicValidationMessage: basicValidationMessage.trim(),
  };
}

// Main entry
if (require.main === module) {
  // Accept labels from stdin or as a file argument
  let rawLabels = '';
  if (process.argv.length > 2) {
    rawLabels = fs.readFileSync(process.argv[2], 'utf8');
  } else {
    rawLabels = fs.readFileSync(0, 'utf8'); // Read from stdin
  }

  const labels = getLabelArray(rawLabels);
  console.log('Normalized Labels:', labels);

  const versionLabels = getVersionLabelArray(labels);

  const invalidVersionLabels = getInvalidVersionLabels(versionLabels);
  const componentVersionLabels = getComponentVersionLabels(versionLabels);
  const hasUntrackedVersion = versionLabels.includes(untrackedLabel);

  // Validate
  let { isValid, basicValidationMessage } = basicValidate(
    invalidVersionLabels,
    componentVersionLabels,
    hasUntrackedVersion
  );

  // TODO: Add advanced validation for component valid and changelog consistency

  const validationMessage = (
    basicValidationMessage ?? '✅ Version labels validation passed.'
  ).replace(/\n/g, '\\n');

  // write outputs for use in later steps
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `isValid=${isValid}\n`);
    fs.appendFileSync(githubOutput, `validationMessage=${validationMessage}\n`);
    fs.appendFileSync(githubOutput, `invalidVersionLabels=${invalidVersionLabels.join(',')}\n`);
    fs.appendFileSync(githubOutput, `hasUntrackedVersion=${hasUntrackedVersion}\n`);
    fs.appendFileSync(githubOutput, `componentVersionLabels=${componentVersionLabels.join(',')}\n`);
  }

  // Set exit code based on validation
  if (!isValid) {
    console.error('::error title=Version Label Validation::' + validationMessage);
    process.exit(1);
  }

  console.log(validationMessage);
  process.exit(0);
}

module.exports = {
  getLabelArray,
  getVersionLabelArray,
  getInvalidVersionLabels,
  getComponentVersionLabels,
  basicValidate,
  versionLabelPrefix,
  untrackedLabel,
  componentVersionRegEx,
};
