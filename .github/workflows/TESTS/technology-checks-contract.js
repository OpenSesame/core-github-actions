const { checkStepGuard, npmScriptSteps, readWorkflow } = require('./workflow-test-helpers');

function describeNpmScriptSteps(workflowFile, expectedScripts) {
  describe(`${workflowFile} npm script steps`, () => {
    const steps = npmScriptSteps(workflowFile);

    test('runs each expected script once, in order, with plain npm run', () => {
      expect(steps.map(step => step.script)).toEqual(expectedScripts);
    });

    test.each(expectedScripts)('runs %s after earlier failures once npm ci succeeded', script => {
      expect(steps.find(step => step.script === script).guard).toBe(checkStepGuard);
    });

    test('keeps the job token read-only and the checkout credential-free', () => {
      const workflow = readWorkflow(workflowFile);
      expect(workflow).toMatch(/^permissions: \{\}$/m);
      expect(workflow).toContain('      contents: read # Required to check out');
      expect(workflow).toContain('persist-credentials: false');
      expect(workflow).toContain('runs-on: ubuntu-26.04');
    });
  });
}

module.exports = { describeNpmScriptSteps };
