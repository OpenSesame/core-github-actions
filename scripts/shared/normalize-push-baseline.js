#!/usr/bin/env node
/**
 * Normalize the baseline ref for push events in GitHub Actions.
 *
 * If a push event is detected but an open PR exists for the branch,
 * this script outputs the PR's base branch as the baseline. Otherwise,
 * it uses the provided INPUT_BASELINE environment variable.
 *
 * Usage: node normalize-push-baseline.js
 *
 * Inputs (via environment variables):
 *  HAS_PR - 'true' if the current context has an associated PR
 *  INPUT_BASELINE - the input baseline ref
 *  GITHUB_EVENT_NAME - GitHub provided environment variable for the GitHub event name (e.g., 'push', 'pull_request')
 *  GITHUB_BASE_REF - GitHub provided environment variable for the base ref from GitHub event (if any)
 *  GITHUB_REF_NAME - GitHub provided environment variable for the branch name of the current ref
 *  GITHUB_TOKEN - GitHub provided environment variable for API access token
 *  GITHUB_REPOSITORY - GitHub provided environment variable for the repository in 'owner/repo' format
 *  GITHUB_OUTPUT - GitHub provided environment variable for step outputs file path
 *
 * Outputs the resolved baseline ref to GITHUB_OUTPUT for GitHub Actions.
 */

const fetch = require('node-fetch');

async function getPrBaseBranch(owner, repo, branch, token) {
  // Use GitHub API to find open PR for the branch and get its base branch
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'normalize-push-baseline-script',
    },
  });
  if (!res.ok) return null;
  const prs = await res.json();
  if (prs.length > 0 && prs[0].base && prs[0].base.ref) {
    return prs[0].base.ref;
  }
  return null;
}

function validateEnvVar(name) {
  if (!process.env[name]) {
    console.error(`::error::Environment variable ${name} is required`);
    process.exit(1);
  }
}

async function normalizeBaseline({
  hasPr,
  inputBaseline,
  eventName,
  ghBaseRef,
  githubRefName,
  githubToken,
  repoFull,
}) {
  const [owner, repo] = repoFull.split('/');
  let baseline = inputBaseline;
  if (eventName === 'pull_request' || hasPr === 'true') {
    let base = ghBaseRef;
    if (!(eventName === 'pull_request' && ghBaseRef)) {
      // Not a PR event or baseRef not set, try to resolve via API
      base = await getPrBaseBranch(owner, repo, githubRefName, githubToken);
    }
    if (base) {
      baseline = `origin/${base}`;
    } else {
      baseline = inputBaseline;
    }
  }
  return baseline;
}

if (require.main === module) {
  validateEnvVar('HAS_PR');
  validateEnvVar('INPUT_BASELINE');
  validateEnvVar('GITHUB_EVENT_NAME');
  validateEnvVar('GITHUB_REF_NAME');
  validateEnvVar('GITHUB_TOKEN');
  validateEnvVar('GITHUB_REPOSITORY');

  const hasPr = process.env.HAS_PR;
  const inputBaseline = process.env.INPUT_BASELINE;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const ghBaseRef = process.env.GITHUB_BASE_REF;
  const githubRefName = process.env.GITHUB_REF_NAME;
  const githubToken = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY;

  (async () => {
    try {
      const baseline = await normalizeBaseline({
        hasPr,
        inputBaseline,
        eventName,
        ghBaseRef,
        githubRefName,
        githubToken,
        repoFull,
      });

      // Output to GITHUB_OUTPUT for GitHub Actions step output
      const githubOutput = process.env.GITHUB_OUTPUT;
      if (githubOutput) {
        const fs = require('fs');
        fs.appendFileSync(githubOutput, `baseline=${baseline}\n`);
      }
      console.log(`Normalized baseline: ${baseline}`);
    } catch (err) {
      console.error(err.message || err);
      process.exit(1);
    }
  })();
}

module.exports = { validateEnvVar, getPrBaseBranch, normalizeBaseline };
