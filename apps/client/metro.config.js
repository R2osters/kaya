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

// Expo Router turns every file under app/ into a route, and the test files are
// colocated there. Without this they are bundled as routes, which drags
// @testing-library into the app graph -- its logger requires Node's `console`,
// which Metro cannot resolve, and the whole bundle fails. Nothing in the test
// suites catches it: they run under jest, never through Metro.
const TEST_FILES = /.*\.test\.(ts|tsx)$/;
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, TEST_FILES]
  : existingBlockList
    ? [existingBlockList, TEST_FILES]
    : [TEST_FILES];

module.exports = config;
