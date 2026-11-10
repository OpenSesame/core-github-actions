// Decides whether a deploy can be skipped because nothing it publishes changed.
//
// mode pull-request gates a pull request run of a dev deploy: it skips when
// everything since the pull request's newest commit whose run passed the proof
// job is ignorable, or when the pull request changes only ignorable files and
// none of its commits were deployed. Re-runs and reopened pull requests always
// deploy.
//
// mode merge gates a merged pull request's deploy through prod: it skips when
// everything since the base branch's newest merge whose run passed the proof
// job is ignorable. Manual runs and re-runs always deploy.
//
// Any doubt deploys, so the gate can only ever cost time, never coverage.

const { spawnSync } = require('node:child_process');
const { appendFileSync, readFileSync } = require('node:fs');
const { setTimeout: sleep } = require('node:timers/promises');

const MODES = {
  'pull-request': { history: 'in the pull request' },
  merge: { history: 'on the base branch' },
};

const DEFAULTS = {
  waitTimeoutMinutes: 40,
  pollIntervalSeconds: 30,
  maxCommits: 50,
};

const MAX_JOB_PAGES = 10;

// Globs match the whole path from the repository root, as git's glob pathspecs
// do: * and ? never cross a /, a ** segment matches any number of directories,
// and a trailing / matches everything under it. Dot files match like any other.
// Anything else that looks like glob syntax is refused, so a pattern never
// silently means something else.
const escapeRegExp = character => character.replace(/[.+^$()|]/g, '\\$&');

const globToRegExp = pattern => {
  if (/[[\]{}!\\]/.test(pattern)) {
    throw new Error(`Unsupported glob "${pattern}": use only *, ** and ?`);
  }
  if (pattern.startsWith('/')) {
    throw new Error(`Unsupported glob "${pattern}": globs are relative to the repository root`);
  }
  const segments = (pattern.endsWith('/') ? `${pattern}**` : pattern).split('/');
  let source = '';
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') {
      source += last ? '.+' : '(?:[^/]+/)*';
      return;
    }
    if (segment === '' || segment.includes('**')) {
      throw new Error(`Unsupported glob "${pattern}": ** must be a whole path segment`);
    }
    for (const character of segment) {
      if (character === '*') source += '[^/]*';
      else if (character === '?') source += '[^/]';
      else source += escapeRegExp(character);
    }
    if (!last) source += '/';
  });
  return new RegExp(`^${source}$`);
};

// One glob per line; blank lines and lines starting with # are ignored.
const parseGlobList = text =>
  (text ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'));

// A path is ignorable when an ignore glob matches it, no deploy glob does, and
// it is not one of the paths that always deploy.
const createClassifier = ({ ignore = [], deploy = [], alwaysDeploy = [] }) => {
  const ignorePatterns = ignore.map(globToRegExp);
  const deployPatterns = deploy.map(globToRegExp);
  const always = new Set(alwaysDeploy);
  return path =>
    !always.has(path) &&
    ignorePatterns.some(pattern => pattern.test(path)) &&
    !deployPatterns.some(pattern => pattern.test(path));
};

const detectPullRequestChanges = async (
  event,
  { changedFiles, isAncestor, pullRequestCommits, findVerifiedCommit, isIgnorable, proofJob }
) => {
  const deployableFiles = files => files.filter(file => !isIgnorable(file));

  if (event.name !== 'pull_request') {
    return { shouldDeploy: true, reason: `${event.name} runs always deploy.` };
  }
  // A re-run asks to test again, so it never relies on earlier results.
  if (event.runAttempt > 1) {
    return {
      shouldDeploy: true,
      reason: `Attempt ${event.runAttempt} is a re-run, which always deploys.`,
    };
  }
  // Pushes to a closed pull request start no run, so the environment may still
  // show changes a reopened one has since dropped.
  if (event.action === 'reopened') {
    return { shouldDeploy: true, reason: 'A reopened pull request always deploys.' };
  }

  const pullRequestFiles = changedFiles(`${event.baseSha}...${event.headSha}`);
  const onlyIgnorableInPullRequest =
    pullRequestFiles.length > 0 && deployableFiles(pullRequestFiles).length === 0;
  const onlyIgnorableResult = {
    shouldDeploy: false,
    reason: 'The pull request changes only ignorable files.',
  };

  // A newly opened pull request has no earlier deploys, so its files decide.
  if (event.action !== 'synchronize') {
    if (onlyIgnorableInPullRequest) return onlyIgnorableResult;
    return {
      shouldDeploy: true,
      reason: 'The pull request changes deployable files.',
      files: deployableFiles(pullRequestFiles),
    };
  }

  // A force-push can drop commits the environment already has, so it always deploys.
  if (!event.beforeSha || !isAncestor(event.beforeSha, event.headSha)) {
    return { shouldDeploy: true, reason: 'The push rewrites the pull request history.' };
  }

  // The push is checked before the whole pull request, so a push that reverts
  // deployed files deploys even when only ignorable files remain.
  const pushFiles = changedFiles(`${event.beforeSha}..${event.headSha}`);
  if (pushFiles.length === 0) {
    // An empty commit is the usual way to ask for a fresh run.
    return { shouldDeploy: true, reason: 'The push changes no files.' };
  }
  if (deployableFiles(pushFiles).length > 0) {
    return {
      shouldDeploy: true,
      reason: 'The push changes deployable files.',
      files: deployableFiles(pushFiles),
    };
  }

  // Searched even when only ignorable files remain, so an earlier deploy that
  // failed, or left the environment on files this push dropped, deploys.
  const search = await findVerifiedCommit(pullRequestCommits(event.beforeSha, event.baseSha));
  if (!search.verifiedSha) {
    if (search.neverDeployed && onlyIgnorableInPullRequest) return onlyIgnorableResult;
    return {
      shouldDeploy: true,
      reason: `The push changes only ignorable files, but no earlier commit is verified: ${search.detail}.`,
    };
  }

  // Covers every push between the verified commit and this one, not just the latest.
  const unverifiedFiles = deployableFiles(changedFiles(`${search.verifiedSha}..${event.headSha}`));
  if (unverifiedFiles.length > 0) {
    return {
      shouldDeploy: true,
      reason: `Deployable files changed since ${search.verifiedSha}, the last commit whose run passed ${proofJob}.`,
      files: unverifiedFiles,
      verifiedSha: search.verifiedSha,
    };
  }
  return {
    shouldDeploy: false,
    reason: `Only ignorable files changed since ${search.verifiedSha}, whose run passed ${proofJob}.`,
    verifiedSha: search.verifiedSha,
  };
};

// The base branch only moves by merges, each deployed by its own run, so the
// diff from the last merge whose run passed the proof job covers every merge the
// gate skipped. A failed or cancelled run, or one still unfinished at the
// timeout, may have left the environment anywhere, so the gate deploys.
const detectMergeChanges = async (
  event,
  { changedFiles, mainCommits, findVerifiedCommit, isIgnorable, proofJob }
) => {
  if (event.name !== 'pull_request') {
    return { shouldDeploy: true, reason: `${event.name} runs always deploy.` };
  }
  if (event.action !== 'closed' || !event.merged) {
    return { shouldDeploy: true, reason: 'Only a merged pull request can skip the deploy.' };
  }
  if (event.runAttempt > 1) {
    return {
      shouldDeploy: true,
      reason: `Attempt ${event.runAttempt} is a re-run, which always deploys.`,
    };
  }

  const search = await findVerifiedCommit(mainCommits(event.headSha));
  if (!search.verifiedSha) {
    return {
      shouldDeploy: true,
      reason: `No earlier merge on the base branch is verified: ${search.detail}.`,
    };
  }

  const unverifiedFiles = changedFiles(`${search.verifiedSha}..${event.headSha}`).filter(
    file => !isIgnorable(file)
  );
  if (unverifiedFiles.length > 0) {
    return {
      shouldDeploy: true,
      reason: `Deployable files changed since ${search.verifiedSha}, the last merge whose run passed ${proofJob}.`,
      files: unverifiedFiles,
      verifiedSha: search.verifiedSha,
    };
  }
  return {
    shouldDeploy: false,
    reason: `Only ignorable files changed since ${search.verifiedSha}, the last merge whose run passed ${proofJob}.`,
    verifiedSha: search.verifiedSha,
  };
};

// Walks commits from newest to oldest to the most recent one whose run
// succeeded with the proof job succeeding. A skipped proof job is never proof:
// it also follows a failed build. It is only passed over when its run
// succeeded, which means the gate skipped the deploy or a newer push superseded
// it. The caller then diffs from the verified commit, so nothing passed over
// goes unchecked. When every commit is passed over, none of them was deployed.
const findVerifiedCommit = async (
  commits,
  {
    getDeployRun,
    proofJob,
    history,
    wait = sleep,
    now = Date.now,
    log = console.log,
    intervalMs = DEFAULTS.pollIntervalSeconds * 1000,
    timeoutMs = DEFAULTS.waitTimeoutMinutes * 60_000,
    maxCommits = DEFAULTS.maxCommits,
  }
) => {
  const deadline = now() + timeoutMs;
  const waitForCompletedRun = async (sha, run) => {
    if (!run || run.status === 'completed') return run;
    if (now() >= deadline) return { status: 'timed-out' };
    log(`Waiting for the run for ${sha} (${run.status}).`);
    await wait(intervalMs);
    return waitForCompletedRun(sha, await getDeployRun(sha));
  };

  for (const sha of commits.slice(0, maxCommits)) {
    const run = await waitForCompletedRun(sha, await getDeployRun(sha));

    // A commit pushed together with later ones has no run of its own.
    if (!run) continue;
    if (run.status === 'timed-out') {
      return { detail: `timed out waiting for the run for ${sha}` };
    }
    if (run.conclusion === 'success' && run.proofConclusion === 'success') {
      return { verifiedSha: sha };
    }
    if (run.conclusion === 'success' && run.proofConclusion === 'skipped') continue;
    return {
      detail: `the run for ${sha} concluded ${run.conclusion} with ${proofJob} ${run.proofConclusion ?? 'missing'}`,
    };
  }
  if (commits.length > maxCommits) {
    return {
      detail: `none of the ${maxCommits} newest earlier commits has a run that passed ${proofJob}`,
    };
  }
  return { detail: `no earlier commit ${history} was deployed`, neverDeployed: true };
};

// An absolute path, so no writable PATH entry can stand in for git. GitHub's
// Ubuntu runners and macOS both install it here.
const GIT = '/usr/bin/git';

const git = arguments_ => {
  const result = spawnSync(GIT, arguments_, { encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
};

const createGit = (run = git) => {
  let historyChecked = false;
  // A shallow clone would diff the wrong ranges or miss earlier commits.
  const requireFullHistory = () => {
    if (historyChecked) return;
    const result = run(['rev-parse', '--is-shallow-repository']);
    if (result.status !== 0) {
      throw new Error(`git rev-parse failed: ${result.stderr.trim()}`);
    }
    if (result.stdout.trim() !== 'false') {
      throw new Error('The checkout is shallow; check out with fetch-depth: 0');
    }
    historyChecked = true;
  };
  const revList = arguments_ => {
    requireFullHistory();
    const result = run(['rev-list', '--first-parent', ...arguments_]);
    if (result.status !== 0) {
      throw new Error(`git rev-list ${arguments_.join(' ')} failed: ${result.stderr.trim()}`);
    }
    return result.stdout.split('\n').filter(Boolean);
  };

  return {
    changedFiles: range => {
      requireFullHistory();
      // --no-renames lists both sides, so moving a file out of an ignored folder deploys.
      const result = run(['diff', '--name-only', '--no-renames', '-z', range]);
      if (result.status !== 0) {
        throw new Error(`git diff ${range} failed: ${result.stderr.trim()}`);
      }
      return result.stdout.split('\0').filter(Boolean);
    },
    isAncestor: (ancestor, descendant) => {
      requireFullHistory();
      return run(['merge-base', '--is-ancestor', ancestor, descendant]).status === 0;
    },
    pullRequestCommits: (fromSha, baseSha) => revList([fromSha, `^${baseSha}`]),
    mainCommits: headSha => revList([`${headSha}~1`]),
    // A merge's run is listed under its pull request's head, the merge's second
    // parent. A commit with none, such as a direct push, has no run of its own.
    pullRequestHead: mergeSha => {
      const result = run(['rev-parse', '--verify', '--quiet', `${mergeSha}^2`]);
      return result.status === 0 ? result.stdout.trim() : undefined;
    },
  };
};

// Reads only pull_request runs of the workflow, so manual deploys, which can
// create jobs with the same names, are never mistaken for its gate.
const createGitHubClient = (
  { apiUrl, repository, token, workflowFile, proofJob, proofCallerJob },
  fetchImpl = fetch
) => {
  const request = async path => {
    const response = await fetchImpl(`${apiUrl}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      // GitHub's message tells a missing permission apart from a rate limit.
      const body = await response.text().catch(() => '');
      throw new Error(`GET ${path} failed with HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    return response.json();
  };

  const findJob = async (runId, name) => {
    for (let page = 1; page <= MAX_JOB_PAGES; page += 1) {
      const query = new URLSearchParams({ filter: 'latest', per_page: '100', page: String(page) });
      const { jobs, total_count: totalCount } = await request(
        `/repos/${repository}/actions/runs/${runId}/jobs?${query}`
      );
      const job = jobs.find(candidate => candidate.name === name);
      if (job || jobs.length === 0 || page * 100 >= totalCount) return job;
    }
    return undefined;
  };

  return {
    getDeployRun: async sha => {
      const query = new URLSearchParams({ head_sha: sha, event: 'pull_request', per_page: '1' });
      const { workflow_runs: runs } = await request(
        `/repos/${repository}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?${query}`
      );
      // Runs are listed newest first; a re-run updates its run in place.
      const [run] = runs;
      if (!run) return undefined;
      if (run.status !== 'completed') return { status: run.status };

      // A reusable workflow call skipped before it starts lists only its
      // caller job, which then stands in for the missing proof job.
      const job =
        (await findJob(run.id, proofJob)) ??
        (proofCallerJob ? await findJob(run.id, proofCallerJob) : undefined);
      return {
        status: run.status,
        conclusion: run.conclusion,
        proofConclusion: job?.conclusion ?? undefined,
      };
    },
  };
};

const positiveInteger = (value, name, fallback) => {
  if (value === '') return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${name} must be a positive whole number`);
  return Number(value);
};

const repositoryPath = (value, name) => {
  const path = value.replace(/^\.\//, '');
  if (path.startsWith('/') || path.split('/').includes('..')) {
    throw new Error(`${name} must be a path inside the repository`);
  }
  return path;
};

// Inputs reach a JavaScript action as INPUT_<NAME> with the name upper-cased.
const readConfig = environment => {
  const input = name => (environment[`INPUT_${name.toUpperCase()}`] ?? '').trim();
  const mode = input('mode');
  if (!Object.hasOwn(MODES, mode)) {
    throw new Error(`mode must be pull-request or merge, not "${mode}"`);
  }
  const workflowFile = input('workflow-file');
  if (!/^[\w.-]+\.ya?ml$/.test(workflowFile)) {
    throw new Error('workflow-file must be a workflow file name, such as on_pr_deploy_dev.yml');
  }
  const proofJob = input('proof-job');
  if (proofJob === '') throw new Error('proof-job is required');

  const ignorePathsFile = input('ignore-paths-file');
  return {
    mode,
    workflowFile,
    proofJob,
    proofCallerJob: input('proof-caller-job'),
    ignorePathsFile: ignorePathsFile && repositoryPath(ignorePathsFile, 'ignore-paths-file'),
    ignorePaths: input('ignore-paths'),
    deployPaths: input('deploy-paths'),
    waitTimeoutMinutes: positiveInteger(
      input('wait-timeout-minutes'),
      'wait-timeout-minutes',
      DEFAULTS.waitTimeoutMinutes
    ),
    pollIntervalSeconds: positiveInteger(
      input('poll-interval-seconds'),
      'poll-interval-seconds',
      DEFAULTS.pollIntervalSeconds
    ),
    maxCommits: positiveInteger(input('max-commits'), 'max-commits', DEFAULTS.maxCommits),
    token: input('github-token'),
  };
};

// The pull request mode deploys the pull request's head; the merge mode deploys
// the merge commit, which is github.sha for a closed pull request.
const readEvent = (environment, mode, readFile) => {
  const payload = environment.GITHUB_EVENT_PATH
    ? JSON.parse(readFile(environment.GITHUB_EVENT_PATH, 'utf8'))
    : {};
  const pullRequest = payload.pull_request ?? {};
  return {
    name: environment.GITHUB_EVENT_NAME,
    action: payload.action,
    merged: pullRequest.merged === true,
    baseSha: pullRequest.base?.sha,
    beforeSha: payload.before,
    headSha: mode === 'merge' ? environment.GITHUB_SHA : pullRequest.head?.sha,
    runAttempt: Number(environment.GITHUB_RUN_ATTEMPT),
  };
};

const singleLine = text => String(text).replace(/[\r\n]+/g, ' ');

const writeResult = (environment, { shouldDeploy, reason, files = [], verifiedSha = '' }) => {
  console.log(`should-deploy=${shouldDeploy}: ${reason}`);
  if (environment.GITHUB_OUTPUT) {
    appendFileSync(
      environment.GITHUB_OUTPUT,
      [
        `should-deploy=${shouldDeploy}`,
        `reason=${singleLine(reason)}`,
        `verified-sha=${verifiedSha}`,
        '',
      ].join('\n')
    );
  }
  if (environment.GITHUB_STEP_SUMMARY) {
    const lines = [shouldDeploy ? '## Deploying' : '## Skipping the deploy', '', reason, ''];
    if (files.length > 0) {
      lines.push('Deployable files:', '', ...files.map(file => `- \`${file}\``), '');
    }
    appendFileSync(environment.GITHUB_STEP_SUMMARY, lines.join('\n'));
  }
};

const main = async (
  environment = process.env,
  { fetchImpl = fetch, readFile = readFileSync, runGit = git, wait, now } = {}
) => {
  let result;
  try {
    const config = readConfig(environment);
    const ignore = [
      ...(config.ignorePathsFile ? parseGlobList(readFile(config.ignorePathsFile, 'utf8')) : []),
      ...parseGlobList(config.ignorePaths),
    ];
    // The ignore file always deploys, so a change to the list is never judged by itself.
    const isIgnorable = createClassifier({
      ignore,
      deploy: parseGlobList(config.deployPaths),
      alwaysDeploy: config.ignorePathsFile ? [config.ignorePathsFile] : [],
    });
    const event = readEvent(environment, config.mode, readFile);
    const repo = createGit(runGit);
    const gitHub = createGitHubClient(
      {
        apiUrl: environment.GITHUB_API_URL,
        repository: environment.GITHUB_REPOSITORY,
        token: config.token,
        workflowFile: config.workflowFile,
        proofJob: config.proofJob,
        proofCallerJob: config.proofCallerJob,
      },
      fetchImpl
    );
    const searchOptions = {
      proofJob: config.proofJob,
      history: MODES[config.mode].history,
      intervalMs: config.pollIntervalSeconds * 1000,
      timeoutMs: config.waitTimeoutMinutes * 60_000,
      maxCommits: config.maxCommits,
      ...(wait && { wait }),
      ...(now && { now }),
    };
    result =
      config.mode === 'merge'
        ? await detectMergeChanges(event, {
            ...repo,
            isIgnorable,
            proofJob: config.proofJob,
            findVerifiedCommit: commits =>
              findVerifiedCommit(commits, {
                ...searchOptions,
                getDeployRun: async sha => {
                  const headSha = repo.pullRequestHead(sha);
                  return headSha ? gitHub.getDeployRun(headSha) : undefined;
                },
              }),
          })
        : await detectPullRequestChanges(event, {
            ...repo,
            isIgnorable,
            proofJob: config.proofJob,
            findVerifiedCommit: commits =>
              findVerifiedCommit(commits, { ...searchOptions, getDeployRun: gitHub.getDeployRun }),
          });
  } catch (error) {
    // fetch reports only "fetch failed" and keeps the network error as its cause.
    const detail = error.cause?.message
      ? `${error.message}: ${error.cause.message}`
      : error.message;
    console.log(
      `::warning title=Detect deployable changes::Change detection failed, deploying: ${singleLine(detail)}`
    );
    result = { shouldDeploy: true, reason: `Change detection failed: ${detail}` };
  }
  writeResult(environment, result);
  return result;
};

if (require.main === module) {
  main();
}

module.exports = {
  createClassifier,
  createGit,
  createGitHubClient,
  detectMergeChanges,
  detectPullRequestChanges,
  findVerifiedCommit,
  globToRegExp,
  main,
  parseGlobList,
  readConfig,
  readEvent,
};
