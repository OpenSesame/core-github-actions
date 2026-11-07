const {
  checkStepGuard,
  extractRunScript,
  npmScriptSteps,
  readWorkflow,
  runStepInRepository,
} = require('./workflow-test-helpers');

function stepEnv(workflowFile, stepName) {
  const lines = readWorkflow(workflowFile).split('\n');
  const stepStart = lines.indexOf(`      - name: ${stepName}`);
  const env = {};
  for (const line of lines.slice(stepStart + 1)) {
    if (line.startsWith('      - ') || line === '        run: |') {
      break;
    }
    const match = line.match(/^ {10}([A-Z_]+): (.+)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }
  return env;
}

function describeNpmScriptSteps(workflowFile, technology, expectedScripts) {
  describe(`${workflowFile} npm script steps`, () => {
    const steps = npmScriptSteps(workflowFile);
    const checkEnv = stepEnv(workflowFile, 'Check npm scripts');
    const checkScripts = files =>
      runStepInRepository(workflowFile, 'checks', 'Check npm scripts', files, checkEnv);

    test('runs each expected script once, in order', () => {
      expect(steps.map(step => step.script)).toEqual(expectedScripts);
    });

    test.each(expectedScripts)('runs %s after earlier failures once npm ci succeeded', script => {
      expect(steps.find(step => step.script === script).guard).toBe(checkStepGuard);
    });

    test('checks exactly the scripts it runs, for this technology', () => {
      expect(checkEnv).toEqual({ TECHNOLOGY: technology, SCRIPTS: expectedScripts.join(' ') });
      expect(readWorkflow(workflowFile)).toContain(
        '      - name: Check npm scripts\n        if: ${{ !cancelled() }}\n'
      );
    });

    test('passes when every script exists', () => {
      const scripts = Object.fromEntries(expectedScripts.map(script => [script, 'true']));
      const result = checkScripts({ 'package.json': JSON.stringify({ scripts }) });

      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain('::error');
    });

    test('reports every missing script, not just the first', () => {
      const result = checkScripts({
        'package.json': JSON.stringify({ scripts: { unrelated: 'true' } }),
      });

      expect(result.status).toBe(1);
      for (const script of expectedScripts) {
        expect(result.stdout).toContain(
          `::error title=Missing npm script::${technology} files are present, but package.json has no ${script} script.`
        );
      }
    });

    test('reports the scripts as missing without a package.json', () => {
      const result = checkScripts({ 'README.md': '# Fixture\n' });

      expect(result.status).toBe(1);
      expect(result.stdout.match(/::error title=Missing npm script::/g)).toHaveLength(
        expectedScripts.length
      );
    });

    test('keeps the job token read-only and the checkout credential-free', () => {
      const workflow = readWorkflow(workflowFile);
      expect(workflow).toMatch(/^permissions: \{\}$/m);
      expect(workflow).toContain('      contents: read # Required to check out');
      expect(workflow).toContain('persist-credentials: false');
      expect(workflow).toContain('runs-on: ubuntu-26.04');
      expect(extractRunScript(workflowFile, 'checks', 'Check npm scripts')).not.toContain(
        'npm run'
      );
    });
  });
}

module.exports = { describeNpmScriptSteps };
