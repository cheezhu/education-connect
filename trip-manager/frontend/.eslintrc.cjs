module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  // Keep the initial config intentionally light to avoid blocking release.
  // We can tighten rules once the codebase stabilizes.
  rules: {}
};

