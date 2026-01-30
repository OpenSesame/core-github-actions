const { spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const SEMGREP_RESULTS_FILE_NAME = 'semgrep_results.json';
const REVIEWDOG_INPUT_FILE_NAME = 'reviewdog_input.txt';

function getPrBaseBranch(owner, repo, branch, token) {
  // Use GitHub API to find open PR for the branch and get its base branch
  const url = `/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${branch}`;
  const options = {
    hostname: 'api.github.com',
    path: url,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'normalize-push-baseline-script',
    },
  };

  return new Promise(resolve => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(null);
        }
        try {
          const prs = JSON.parse(data);
          if (Array.isArray(prs) && prs.length > 0 && prs[0].base && prs[0].base.ref) {
            resolve(prs[0].base.ref);
          } else {
            resolve(null);
          }
        } catch (_e) {
          resolve(null);
        }
      });
    });
    req.on('error', _err => {
      resolve(null);
    });
    req.end();
  });
}

/* Normalize the baseline ref for push events in GitHub Actions.
 *
 * If a push event is detected but an open PR exists for the branch,
 * this script outputs the PR's base branch as the baseline. Otherwise,
 * it uses the provided INPUT_BASELINE environment variable.
 */
async function normalizeBaseline(hasPr, inputBaseline, githubDetails) {
  const { repo, eventName, refName, baseRef, githubToken } = githubDetails;
  const [repoOwner, repoName] = repo.split('/');
  let baseline = inputBaseline;
  if (eventName === 'pull_request' || hasPr === 'true') {
    let base = baseRef;
    if (!(eventName === 'pull_request' && baseRef)) {
      // Not a PR event or baseRef not set, try to resolve via API
      base = await getPrBaseBranch(repoOwner, repoName, refName, githubToken);
    }
    if (base) {
      baseline = `origin/${base}`;
    } else {
      baseline = inputBaseline;
    }
  }
  console.log(`Normalized baseline: ${baseline}\n`);
  return baseline;
}

function constructSemgrepCommand(baseline, config, resultsFileName) {
  const { rules, targets, scanMode, failLevel, extraArgs } = config;
  let cmd = 'semgrep';

  // Add each --config argument
  rules
    .split(/[,\s]+/)
    .filter(Boolean)
    .forEach(cfg => {
      cmd += ` --config ${cfg}`;
    });

  cmd += ` --severity ${failLevel.toUpperCase()} --json --output ${resultsFileName}`;

  if (scanMode === 'diff') {
    cmd += ` --baseline-commit ${baseline}`;
  }

  if (extraArgs) {
    cmd += ` ${extraArgs}`;
  }

  targets
    .split(/[,\s]+/)
    .filter(Boolean)
    .forEach(tgt => {
      cmd += ` ${tgt}`;
    });

  console.log(`Generated Semgrep command: ${cmd}`);
  return cmd;
}

function runSemgrepAndCapture(semgrepCmd, resultsFileName) {
  // we are trusting internal engineers not to pass untrusted arguments to semgrep GHA
  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
  const result = spawnSync(semgrepCmd, { encoding: 'utf-8', shell: true });

  if (result.error) {
    // This is a Node.js error, not a Semgrep error
    console.error(`::error title=Semgrep spawn error::${result.error.message}`);
    process.exit(2);
  }

  if (result.stderr) {
    console.error(`::error title=Semgrep stderr::${result.stderr}`);
  }

  // code 0 (no findings) or 1 (has findings): continue, findings handled by scanStatus
  if (result.status > 1) {
    console.error(`::error title=Semgrep execution error::Exited with code ${result.status}`);
    try {
      const content = fs.readFileSync(resultsFileName, 'utf-8');
      console.log(`Semgrep results file content:\n${content}`);
    } catch (e) {
      console.log(`Error reading semgrep results file: ${e.message}`);
    }
    process.exit(result.status);
  }

  // Ensure results file exists even if no findings
  if (!fs.existsSync(resultsFileName) || fs.statSync(resultsFileName).size === 0) {
    console.log('No results file found or file is empty, creating empty results file.');
    fs.writeFileSync(resultsFileName, '{"results":[]}');
  }
}

function stageResultsForReviewdog(resultsFileName) {
  const data = fs.readFileSync(resultsFileName, 'utf8');
  const resultsJson = JSON.parse(data);

  const lines = resultsJson.results.map(result => {
    const severityInitial = result.extra.severity ? result.extra.severity.charAt(0) : 'I';
    return `${severityInitial}:${result.path}:${result.end.line} ${result.extra.message}`;
  });

  fs.writeFileSync(REVIEWDOG_INPUT_FILE_NAME, lines.join('\n'));
}

function getSemgrepMetrics(resultsFileName) {
  const data = fs.readFileSync(resultsFileName, 'utf8');
  const resultsJson = JSON.parse(data);

  let totalFindings = 0;
  let numErrors = 0;
  let numWarnings = 0;
  let numInfo = 0;

  if (resultsJson.results && Array.isArray(resultsJson.results)) {
    totalFindings = resultsJson.results.length;
    resultsJson.results.forEach(result => {
      switch (result.extra.severity) {
        case 'ERROR':
          numErrors += 1;
          break;
        case 'WARNING':
          numWarnings += 1;
          break;
        case 'INFO':
          numInfo += 1;
          break;
        default:
          break;
      }
    });
  }

  return { totalFindings, numErrors, numWarnings, numInfo };
}

function writeFindingsMarkdown(metrics) {
  const { totalFindings, numErrors, numWarnings, numInfo } = metrics;

  let lines = [];
  lines.push('### Scan Findings');
  lines.push('| Total | Errors | Warnings | Info |');
  lines.push('|------:|------:|--------:|----:|');
  lines.push(`| ${totalFindings} | ${numErrors} | ${numWarnings} | ${numInfo} |`);

  return lines.join('\n');
}

function writeConfigMarkdown(baseline, config) {
  const { rules, targets, scanMode, failLevel, extraArgs } = config;

  let lines = [];
  lines.push('### Scan Config');
  lines.push(`- **Rules**: \`${rules}\``);
  lines.push(`- **Targets**: \`${targets}\``);
  lines.push(`- **Scan mode**: \`${scanMode}\``);
  if (scanMode !== 'full') {
    lines.push(`- **Baseline**: \`${baseline}\``);
  } else {
    lines.push('- **Baseline**: `n/a`');
  }
  lines.push(`- **Fail level**: \`${failLevel}\``);
  lines.push(`- **Extra args**: \`${extraArgs || 'n/a'}\``);

  return lines.join('\n');
}

function evaluateScanStatus(failLevel, metrics) {
  const { numErrors, numWarnings, numInfo } = metrics;
  const level = failLevel.toUpperCase();

  let status = 'success';
  switch (level) {
    case 'CRITICAL':
    case 'ERROR':
    case 'HIGH':
      if (numErrors > 0) status = 'failure';
      break;
    case 'WARNING':
    case 'MEDIUM':
      if (numErrors + numWarnings > 0) status = 'failure';
      break;
    case 'INFO':
    case 'LOW':
      if (numErrors + numWarnings + numInfo > 0) status = 'failure';
      break;
    default:
      break;
  }
  return status;
}

async function main() {
  [
    'HAS_PR',
    'INPUT_BASELINE',
    'GITHUB_EVENT_NAME',
    'GITHUB_REF_NAME',
    'GITHUB_TOKEN',
    'GITHUB_REPOSITORY',
    'SEMGREP_CONFIG',
    'SEMGREP_TARGETS',
    'SCAN_MODE',
    'FAIL_LEVEL',
  ].forEach(key => validateEnvVar(key));

  const prDetails = {
    hasPr: process.env.HAS_PR,
    prNumber: process.env.PR_NUMBER || '',
    prUrl: process.env.PR_URL || '',
  };
  const semgrepConfig = {
    rules: process.env.SEMGREP_CONFIG,
    targets: process.env.SEMGREP_TARGETS,
    scanMode: process.env.SCAN_MODE,
    failLevel: process.env.FAIL_LEVEL,
    extraArgs: process.env.EXTRA_ARGS || '',
  };
  const githubDetails = {
    repo: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME,
    refName: process.env.GITHUB_REF_NAME,
    baseRef: process.env.GITHUB_BASE_REF,
    githubToken: process.env.GITHUB_TOKEN,
  };
  const inputBaseline = process.env.INPUT_BASELINE;

  console.log(`prDetails: ${JSON.stringify(prDetails)}\n`);
  console.log(`semgrepConfig: ${JSON.stringify(semgrepConfig)}\n`);
  console.log(`githubDetails: ${JSON.stringify(githubDetails)}\n`);
  console.log(`inputBaseline: ${inputBaseline}`);

  const baseline = await normalizeBaseline(prDetails.hasPr, inputBaseline, githubDetails);

  const semgrepCmd = constructSemgrepCommand(baseline, semgrepConfig, SEMGREP_RESULTS_FILE_NAME);

  runSemgrepAndCapture(semgrepCmd, SEMGREP_RESULTS_FILE_NAME);

  const metrics = getSemgrepMetrics(SEMGREP_RESULTS_FILE_NAME);

  stageResultsForReviewdog(SEMGREP_RESULTS_FILE_NAME);

  const scanSummary = writeFindingsMarkdown(metrics, baseline, semgrepConfig);
  const configSummary = writeConfigMarkdown(baseline, semgrepConfig);

  const scanStatus = evaluateScanStatus(semgrepConfig.failLevel, metrics);

  // write GitHub Action outputs
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `normalizedBaseline=${baseline}\n`);
    fs.appendFileSync(githubOutput, `scanSummary=${scanSummary.replace(/\n/g, '\\n')}\n`);
    fs.appendFileSync(githubOutput, `configSummary=${configSummary.replace(/\n/g, '\\n')}\n`);
    fs.appendFileSync(githubOutput, `scanStatus=${scanStatus}\n`);
    fs.appendFileSync(githubOutput, `totalFindings=${metrics.totalFindings}\n`);
    fs.appendFileSync(githubOutput, `numErrors=${metrics.numErrors}\n`);
    fs.appendFileSync(githubOutput, `numWarnings=${metrics.numWarnings}\n`);
    fs.appendFileSync(githubOutput, `numInfo=${metrics.numInfo}\n`);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(err => {
    console.error(`::error title=Run Semgrep Scan::${err.message}`);
    process.exit(1);
  });
}

function validateEnvVar(name) {
  if (!process.env[name]) {
    console.error(`::error::Environment variable ${name} is required`);
    process.exit(1);
  }
}

module.exports = {
  main,
  getPrBaseBranch,
  normalizeBaseline,
  constructSemgrepCommand,
  runSemgrepAndCapture,
  stageResultsForReviewdog,
  getSemgrepMetrics,
  writeFindingsMarkdown,
  writeConfigMarkdown,
  evaluateScanStatus,
  validateEnvVar,
  SEMGREP_RESULTS_FILE_NAME,
  REVIEWDOG_INPUT_FILE_NAME,
};
