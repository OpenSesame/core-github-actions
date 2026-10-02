// validate-version-labels.js
// Script to validate version labels for CI workflows
//
// Usage:
//   node validate-version-labels.js <labels-file>
//   echo -e "v:a/foo/1.2.3\nv:wf/bar/2.0.0\nother" | node scripts/internal-ci/validate-version-labels.js
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
//       invalidComponents: comma-separated list of invalid component paths
//       missingChangelogs: comma-separated list of components missing changelog entries
//       validComponents: comma-separated list of valid components with versions in format component-path/X.Y.Z
//   - Exits with code 1 on validation failure, 0 on success

const fs = require('fs');

// Returns an array of normalized, trimmed, non-empty label strings
function getLabelArray(rawLabels) {
  return rawLabels
    .split('\n')
    .map(l => l.trim().toLowerCase())
    .filter(Boolean);
}

const versionLabelPrefix = 'v:';
const untrackedLabel = `${versionLabelPrefix}untracked`; // Special label for untracked versions, 'v:untracked'
const componentTypeAliases = {
  a: 'actions',
  wf: 'workflows',
};
const semverPattern = '\\d+\\.\\d+\\.\\d+'; // Semantic versioning pattern e.g., v1.2.3
// Pattern for valid version label: v:<a|wf>/component-name/X.Y.Z
const componentVersionRegEx = new RegExp(
  `^${versionLabelPrefix}(${Object.keys(componentTypeAliases).join('|')})/([a-z0-9_-]+)/(${semverPattern})$`
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

/// Expands a compact component version label into its canonical tag path
/// It is assumed that the component version label is valid when this function is called
function expandComponentVersionLabel(componentVersionLabel) {
  const match = componentVersionLabel.match(componentVersionRegEx);
  if (!match) {
    return null;
  }

  const [, componentTypeAlias, componentName, version] = match;
  return `${componentTypeAliases[componentTypeAlias]}/${componentName}/${version}`;
}

/// Parses component version labels into a map of component paths to versions
/// It is assumed that component version labels are valid when this function is called
function parseComponentVersionLabels(componentVersionLabels) {
  const componentVersionMap = {};
  componentVersionLabels.forEach(label => {
    const componentTag = expandComponentVersionLabel(label);
    if (componentTag) {
      const lastSlashIndex = componentTag.lastIndexOf('/');
      const component = componentTag.substring(0, lastSlashIndex);
      const version = componentTag.substring(lastSlashIndex + 1);
      componentVersionMap[component] = version;
    }
  });
  return componentVersionMap;
}

/// Checks for existence of paths in the repo matching the component
function getInvalidComponents(componentVersionMap) {
  if (Object.keys(componentVersionMap).length == 0) {
    return [];
  }

  let invalidComponents = [];
  for (const path of Object.keys(componentVersionMap)) {
    if (path.startsWith('actions/')) {
      const expectedDir = `.github/${path}`;
      if (!fs.existsSync(expectedDir) || !fs.lstatSync(expectedDir).isDirectory()) {
        invalidComponents.push(path);
      }
    } else if (path.startsWith('workflows/')) {
      const expectedFile = `.github/${path}.yml`;
      if (!fs.existsSync(expectedFile) || !fs.lstatSync(expectedFile).isFile) {
        invalidComponents.push(path);
      }
    } else {
      invalidComponents.push(path);
    }
  }

  return invalidComponents;
}

/// Checks for CHANGELOG.md entry matching the version for each component
/// It is assumed that the components exist when this function is called
function getMissingChangelogs(componentVersionMap) {
  let missingChangelogs = [];
  for (const path of Object.keys(componentVersionMap)) {
    let changelogPath;
    if (path.startsWith('actions/')) {
      // Expected changelog path: .github/<component-path>/CHANGELOG.md
      changelogPath = `.github/${path}/CHANGELOG.md`;
    } else if (path.startsWith('workflows/')) {
      // Expected changelog path: .github/workflows/CHANGELOGS/<workflow-name>.md
      const workflowName = path.replace(/^workflows\//, '');
      changelogPath = `.github/workflows/CHANGELOGS/${workflowName}.md`;
    } else {
      // Unknown type, skip
      missingChangelogs.push(path);
      continue;
    }
    if (!fs.existsSync(changelogPath)) {
      missingChangelogs.push(path);
      continue;
    }
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    const expectedVersionHeader = `## ${componentVersionMap[path]}`;
    if (!changelogContent.includes(expectedVersionHeader)) {
      missingChangelogs.push(path);
    }
  }

  return missingChangelogs;
}

function validate(
  hasInvalidVersionLabels,
  hasComponentVersionLabels,
  hasUntrackedVersion,
  hasInvalidComponents,
  hasMissingChangelogs
) {
  const hasVersionLabels =
    hasInvalidVersionLabels || hasComponentVersionLabels || hasUntrackedVersion;
  const hasConflictingVersions = hasUntrackedVersion && hasComponentVersionLabels > 0;

  let validationMessage = '';
  let isValid = false;
  if (!hasVersionLabels) {
    validationMessage = '- No version labels found. At least one version label is required\n';
  }
  if (hasInvalidVersionLabels) {
    validationMessage += '- Invalid version labels found\n';
  }
  if (hasConflictingVersions) {
    validationMessage +=
      '- Conflicting version labels found: both untracked and component version labels present\n';
  }
  if (hasInvalidComponents) {
    validationMessage += '- Non-existent components found (invalid paths)\n';
  }
  if (hasMissingChangelogs) {
    validationMessage += '- Missing or incomplete CHANGELOG.md entries found\n';
  }

  if (validationMessage === '') {
    validationMessage = 'Version validation passed';
    isValid = true;
  }

  return {
    isValid,
    validationMessage: validationMessage.trim(),
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

  const componentVersionMap = parseComponentVersionLabels(componentVersionLabels);

  const invalidComponents = getInvalidComponents(componentVersionMap);

  let validComponentMap = Object.fromEntries(
    Object.entries(componentVersionMap).filter(
      ([component]) => !invalidComponents.includes(component)
    )
  );

  const missingChangelogs = getMissingChangelogs(validComponentMap);

  validComponentMap = Object.fromEntries(
    Object.entries(validComponentMap).filter(
      ([component]) => !missingChangelogs.includes(component)
    )
  );

  // Validate
  let { isValid, validationMessage } = validate(
    invalidVersionLabels.length > 0,
    componentVersionLabels.length,
    hasUntrackedVersion,
    invalidComponents.length > 0,
    missingChangelogs.length > 0
  );

  // write outputs for use in later steps
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `isValid=${isValid}\n`);
    fs.appendFileSync(githubOutput, `invalidVersionLabels=${invalidVersionLabels.join(', ')}\n`);
    fs.appendFileSync(githubOutput, `hasUntrackedVersion=${hasUntrackedVersion}\n`);
    fs.appendFileSync(
      githubOutput,
      `componentVersionLabels=${componentVersionLabels.join(', ')}\n`
    );
    fs.appendFileSync(githubOutput, `invalidComponents=${invalidComponents.join(', ')}\n`);
    fs.appendFileSync(githubOutput, `missingChangelogs=${missingChangelogs.join(', ')}\n`);
    fs.appendFileSync(
      githubOutput,
      `validationMessage=${validationMessage.replace(/\n/g, '\\n')}\n`
    );
    fs.appendFileSync(
      githubOutput,
      `validComponents=${Object.entries(validComponentMap)
        .map(([k, v]) => `${k}/${v}`)
        .join(',')}\n`
    );
  }

  // Set exit code based on validation
  if (!isValid) {
    console.error(`::error title=Version Validation Failed::${validationMessage}`);
    process.exit(1);
  }

  console.log(`✅${validationMessage}`);
  process.exit(0);
}

module.exports = {
  getLabelArray,
  getVersionLabelArray,
  getInvalidVersionLabels,
  getComponentVersionLabels,
  expandComponentVersionLabel,
  parseComponentVersionLabels,
  getInvalidComponents,
  getMissingChangelogs,
  validate,
  versionLabelPrefix,
  untrackedLabel,
  componentTypeAliases,
  componentVersionRegEx,
};
