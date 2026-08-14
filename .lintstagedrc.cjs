/**
 * Only backend/ has JS/TS tooling today (apps/, packages/ are Flutter - dart
 * format is out of scope here). Binaries are resolved from backend's own
 * node_modules since no root-level eslint/prettier install exists.
 *
 * backend/package.json has never declared an `eslint` devDependency (true
 * since the initial commit), so `backend/node_modules/.bin/eslint` does not
 * exist in a plain `npm ci` install -- only `prettier` does. The eslint step
 * is skipped when the binary is absent instead of hard-failing every commit
 * that touches a backend/*.ts file.
 *
 * This config file lives at the main worktree's root, but git worktrees
 * (core.hooksPath points here from every linked worktree) run lint-staged
 * with `cwd` set to whichever worktree the commit happens in -- not this
 * file's own directory. The command strings below are relative and get
 * resolved against that `cwd` by the shell, so the existence check must use
 * `process.cwd()`, not `__dirname`, or it can check the wrong worktree's
 * node_modules entirely.
 */
const fs = require('fs');
const path = require('path');

const backendEslintBin = path.join(process.cwd(), 'backend', 'node_modules', '.bin', 'eslint');

module.exports = {
  'backend/**/*.ts': (filenames) => {
    const files = filenames.map((f) => JSON.stringify(f)).join(' ');
    const commands = [`backend/node_modules/.bin/prettier --write ${files}`];
    if (fs.existsSync(backendEslintBin)) {
      commands.push(`backend/node_modules/.bin/eslint --fix ${files}`);
    }
    return commands;
  },
};
