function validateEnvVar(name) {
  if (!process.env[name]) {
    console.error(`::error::Environment variable ${name} is required`);
    process.exit(1);
  }
}

module.exports = {
  validateEnvVar,
};
