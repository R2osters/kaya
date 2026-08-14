/** Conventional Commits, enforced at commit-msg via husky. See ASSISTANT.md. */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
  },
  ignores: [(commit) => commit.includes('Merge')],
};
