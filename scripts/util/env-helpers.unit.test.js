const { validateEnvVar } = require('./env-helpers');

describe('validateEnvVar', () => {
  const ORIGINAL_EXIT = process.exit;
  const ORIGINAL_CONSOLE_ERROR = console.error;

  beforeEach(() => {
    process.exit = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    process.exit = ORIGINAL_EXIT;
    console.error = ORIGINAL_CONSOLE_ERROR;
  });

  it('does not exit when env var is set', () => {
    process.env.TEST_VAR = 'value';
    validateEnvVar('TEST_VAR');
    expect(process.exit).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    delete process.env.TEST_VAR;
  });

  it('exits with error when env var is not set', () => {
    delete process.env.TEST_VAR;
    validateEnvVar('TEST_VAR');
    expect(console.error).toHaveBeenCalledWith(
      '::error::Environment variable TEST_VAR is required'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
