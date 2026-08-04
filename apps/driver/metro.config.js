// Monorepo Metro config. @kaya/core and @kaya/ui are npm workspace packages;
// npm links them into node_modules as symlinks back to packages/kaya-core and
// packages/kaya-ui, so Metro has to be told explicitly to follow symlinks and
// to watch the workspace root, or it never sees the real source files.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so edits under packages/ trigger a Metro refresh.
config.watchFolders = [workspaceRoot];

// Resolve modules from this app's node_modules first, then fall back to the
// hoisted root node_modules that npm workspaces installs shared deps into.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The default Metro resolver treats a symlink as an opaque node_modules
// entry rather than following it to the workspace package's real files.
// Without this, @kaya/core and @kaya/ui fail to resolve entirely.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
