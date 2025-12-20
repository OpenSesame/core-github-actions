/// Reads labels from all_labels.txt and outputs whether untracked is present
/// and a comma-separated list of component version tags for GitHub Actions.
///
/// Outputs:
///   HAS_UNTRACKED=true|false
///   componentTags=type/name/X.Y.Z,...
/// Usage:
///   node scripts/internal-ci/get-version-tags/index.js <labels-file>

const fs = require('fs');
const {
  getLabelArray,
  versionLabelPrefix,
  untrackedLabel,
  componentVersionRegEx,
} = require('../validate-version-labels/index.js');

// Main entry
if (require.main === module) {
  // Accept labels from stdin or as a file argument
  const rawLabels = fs.readFileSync(process.argv[2], 'utf8');

  const labels = getLabelArray(rawLabels);

  const hasUntracked = labels.includes(untrackedLabel);

  const componentTags = labels
    .filter(label => componentVersionRegEx.test(label))
    .map(label => label.slice(versionLabelPrefix.length));

  // write outputs for use in later steps
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `hasUntracked=${hasUntracked}\n`);
    fs.appendFileSync(githubOutput, `componentTags=${componentTags.join(',')}\n`);
  }
}
