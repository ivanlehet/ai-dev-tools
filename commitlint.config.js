// Conventional Commits — used ONLY for readable history and changelog categorization.
// The authoritative source of version intent is Nx Version Plans (`nx release plan`),
// NOT commit messages. See docs/POLICY.md and the release workflow.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow scopes matching our tool/package names; keep the subject meaningful.
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'body-max-line-length': [0, 'always'],
  },
};
