const fs = require('fs');

function parseGithubOutput(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(/=(.*)/).slice(0, 2))
  );
}

module.exports = {
  parseGithubOutput,
};
