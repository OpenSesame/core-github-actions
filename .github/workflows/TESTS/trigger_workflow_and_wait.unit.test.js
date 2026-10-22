const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflowPath = path.join(__dirname, '..', 'trigger_workflow_and_wait.yml');

function extractRunScript(jobId, stepName) {
  const lines = fs.readFileSync(workflowPath, 'utf8').split('\n');
  const jobStart = lines.indexOf(`  ${jobId}:`);
  const stepStart = lines.indexOf(`      - name: ${stepName}`, jobStart);
  const runStart = lines.indexOf('        run: |', stepStart);

  if (jobStart === -1 || stepStart === -1 || runStart === -1) {
    throw new Error(`Unable to find the '${stepName}' run script in job '${jobId}'`);
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

const fakeCurl = `#!/usr/bin/env bash
url=""
data=""
while [ $# -gt 0 ]; do
  case "$1" in
    --data) data="$2"; shift ;;
    http*) url="$1" ;;
  esac
  shift
done
printf '%s\\n' "$url" >> "$CALLS"
case "$url" in
  */dispatches) printf '%s' "$data" > "$DISPATCH_BODY"; printf '%s' "$DISPATCH_RESPONSE" ;;
  */runs/*) printf '%s' "$RUN_RESPONSE" ;;
  *) exit 22 ;;
esac
`;

function runDispatch({ payload = '{"environment":"dev"}', dispatchResponse, runResponse }) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-workflow-'));
  const binDirectory = path.join(temporaryDirectory, 'bin');
  const outputPath = path.join(temporaryDirectory, 'output');
  const callsPath = path.join(temporaryDirectory, 'calls');
  const bodyPath = path.join(temporaryDirectory, 'body');

  fs.mkdirSync(binDirectory);
  fs.writeFileSync(path.join(binDirectory, 'curl'), fakeCurl, { mode: 0o755 });

  try {
    const result = spawnSync(
      'bash',
      [
        '--noprofile',
        '--norc',
        '-eo',
        'pipefail',
        '-c',
        extractRunScript('trigger', 'Dispatch and wait'),
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          API_URL: 'https://api.github.com',
          OWNER: 'OpenSesame',
          REPO: 'example-service',
          WORKFLOW_FILE: 'run_e2e.yml',
          REF: 'main',
          TOKEN: 'token',
          WAIT_INTERVAL: '0',
          CLIENT_PAYLOAD: payload,
          GITHUB_OUTPUT: outputPath,
          CALLS: callsPath,
          DISPATCH_BODY: bodyPath,
          DISPATCH_RESPONSE: dispatchResponse,
          RUN_RESPONSE: runResponse,
        },
      }
    );

    const read = filePath => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
    return {
      ...result,
      output: read(outputPath),
      calls: read(callsPath).split('\n').filter(Boolean),
      body: read(bodyPath),
    };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const dispatched = JSON.stringify({
  workflow_run_id: 9876543210,
  run_url: 'https://api.github.com/repos/OpenSesame/example-service/actions/runs/9876543210',
  html_url: 'https://github.com/OpenSesame/example-service/actions/runs/9876543210',
});

const completed = conclusion => JSON.stringify({ status: 'completed', conclusion });

describe('trigger_workflow_and_wait Dispatch and wait', () => {
  test('waits on the run returned by the dispatch', () => {
    const result = runDispatch({ dispatchResponse: dispatched, runResponse: completed('success') });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.body)).toEqual({
      ref: 'main',
      inputs: { environment: 'dev' },
      return_run_details: true,
    });
    expect(result.calls).toEqual([
      'https://api.github.com/repos/OpenSesame/example-service/actions/workflows/run_e2e.yml/dispatches',
      'https://api.github.com/repos/OpenSesame/example-service/actions/runs/9876543210',
    ]);
    expect(result.output).toBe(
      [
        'downstream-run-id=9876543210',
        'downstream-html-url=https://github.com/OpenSesame/example-service/actions/runs/9876543210',
        'conclusion=success',
        '',
      ].join('\n')
    );
  });

  test('fails when the downstream run does not succeed', () => {
    const result = runDispatch({ dispatchResponse: dispatched, runResponse: completed('failure') });

    expect(result.status).toBe(1);
    expect(result.output).toContain('conclusion=failure\n');
  });

  test.each([
    ['an empty 204 response', ''],
    ['a response without workflow_run_id', '{"html_url":"https://github.com/x"}'],
    ['a non-JSON response', 'not json'],
  ])('fails without guessing a run on %s', (_case, dispatchResponse) => {
    const result = runDispatch({ dispatchResponse, runResponse: completed('success') });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Trigger workflow and wait::The dispatch response'
    );
    expect(result.calls).toHaveLength(1);
    expect(result.output).toBe('');
  });

  test.each([
    ['invalid JSON', '{'],
    ['a JSON array', '[]'],
  ])('rejects client-payload that is %s before dispatching', (_case, payload) => {
    const result = runDispatch({
      payload,
      dispatchResponse: dispatched,
      runResponse: completed('success'),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      '::error title=Trigger workflow and wait::client-payload must be a JSON object'
    );
    expect(result.calls).toEqual([]);
  });
});
