/// Reads labels from a file and outputs whether untracked is present
/// and a comma-separated list of component version tags for GitHub Actions.
///
/// Outputs:
///   hasUntracked=true|false
///   componentTags=type/name/X.Y.Z,...
/// Exits with code 1, writing no outputs, when a component has more than one version label.
/// Usage:
///   node scripts/internal-ci/get-version-tags/index.js <labels-file>

const fs = require('fs');
const {
  getLabelArray,
  getVersionLabelArray,
  getComponentVersionLabels,
  getDuplicateComponents,
  untrackedLabel,
  expandComponentVersionLabel,
} = require('../validate-version-labels/index.js');

// Main entry
if (require.main === module) {
  const rawLabels = fs.readFileSync(process.argv[2], 'utf8');

  const versionLabels = getVersionLabelArray(getLabelArray(rawLabels));

  const hasUntracked = versionLabels.includes(untrackedLabel);

  const componentVersionLabels = getComponentVersionLabels(versionLabels);
  const duplicateComponents = getDuplicateComponents(componentVersionLabels);
  if (duplicateComponents.length > 0) {
    console.error(
      `::error title=Duplicate Version Labels::More than one version label for: ${duplicateComponents.join(', ')}`
    );
    process.exit(1);
  }

  const componentTags = componentVersionLabels.map(expandComponentVersionLabel);

  // write outputs for use in later steps
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `hasUntracked=${hasUntracked}\n`);
    fs.appendFileSync(githubOutput, `componentTags=${componentTags.join(',')}\n`);
  }
}
