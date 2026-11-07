const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflowsDirectory = path.join(__dirname, '..');

const checkStepGuard = "if: ${{ !cancelled() && steps.install.outcome == 'success' }}";

function readWorkflow(workflowFile) {
  return fs.readFileSync(path.join(workflowsDirectory, workflowFile), 'utf8');
}

function extractRunScript(workflowFile, jobId, stepName) {
  const lines = readWorkflow(workflowFile).split('\n');
  const jobStart = lines.indexOf(`  ${jobId}:`);
  const stepStart = jobStart === -1 ? -1 : lines.indexOf(`      - name: ${stepName}`, jobStart);
  const runStart = stepStart === -1 ? -1 : lines.indexOf('        run: |', stepStart);

  if (jobStart === -1 || stepStart === -1 || runStart === -1) {
    throw new Error(
      `Unable to find the '${stepName}' run script in job '${jobId}' of ${workflowFile}`
    );
  }

  const script = [];
  for (const line of lines.slice(runStart + 1)) {
    if (line !== '' && !line.startsWith(' '.repeat(10))) {
      break;
    }
    script.push(line.slice(10));
  }

  return script.join('\n');
}

function npmScriptSteps(workflowFile) {
  const lines = readWorkflow(workflowFile).split('\n');
  const steps = [];

  lines.forEach((line, index) => {
    const match = line.match(/^ {8}run: npm run (\S+)$/);
    if (match) {
      steps.push({ guard: lines[index - 1].trim(), script: match[1] });
    }
  });

  return steps;
}

function createRepository(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-checks-fixture-'));

  for (const [filePath, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory, filePath)), { recursive: true });
    fs.writeFileSync(path.join(directory, filePath), contents);
  }

  const git = args => spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  git(['init', '--quiet']);
  git(['add', '--all']);

  return directory;
}

function parseOutputs(file) {
  if (!fs.existsSync(file)) {
    return {};
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(/=(.*)/).slice(0, 2))
  );
}

function runScript(script, { cwd, env = {} } = {}) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-checks-run-'));
  const outputPath = path.join(temporaryDirectory, 'output');
  const summaryPath = path.join(temporaryDirectory, 'summary');

  try {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
      cwd: cwd || temporaryDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNNER_TEMP: temporaryDirectory,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        ...env,
      },
    });

    return {
      ...result,
      outputs: parseOutputs(outputPath),
      summary: fs.existsSync(summaryPath) ? fs.readFileSync(summaryPath, 'utf8') : '',
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function runStepInRepository(workflowFile, jobId, stepName, files, env) {
  const repository = createRepository(files);
  try {
    return runScript(extractRunScript(workflowFile, jobId, stepName), { cwd: repository, env });
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

module.exports = {
  checkStepGuard,
  createRepository,
  extractRunScript,
  npmScriptSteps,
  readWorkflow,
  runScript,
  runStepInRepository,
};
