#!/usr/bin/env node
/**
 * Regenerates an Expo Router app's `.expo/types/router.d.ts`.
 *
 * Why this exists rather than letting the dev server do it:
 *
 * Test files are colocated under `app/` (see either app's metro.config.js),
 * and expo-router treats every `.tsx` under `app/` as a route -- the ignore
 * pattern it ships excludes only `+api`/`+html`/`+native-intent`. Metro is
 * told about the test files through `resolver.blockList`, so the *bundle* is
 * correct and the app runs. The type generator is a different code path and
 * does not consult Metro's blockList, so it sees `_layout.test.tsx` and
 * `_layout.locale.test.tsx` as two layouts claiming `/_layout.test`,
 * `getRoutes()` throws, and expo-router's generator catches that exception and
 * writes a declaration listing *no routes at all* -- silently.
 *
 * The result is an 816-byte `router.d.ts` in which `Href` degrades to
 * `RelativePathString | ExternalPathString`, so every `router.push("/login")`
 * in both apps fails to typecheck: 49 errors across 34 files, none of which
 * points anywhere near the cause.
 *
 * This applies the same test-file exclusion Metro already has, then calls
 * expo-router's own generator, so the output is exactly what a dev server that
 * could see the routes would have written.
 *
 * Usage: node scripts/regen-router-types.mjs apps/client [apps/driver ...]
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "..");
const fromRoot = (id) => require(path.join(repoRoot, "node_modules", id));

const { EXPO_ROUTER_CTX_IGNORE } = fromRoot("expo-router/_ctx-shared");
const requireContext = fromRoot(
  "expo-router/build/testing-library/require-context-ponyfill",
).default;
const { getTypedRoutesDeclarationFile } = fromRoot(
  "expo-router/build/typed-routes/generate.js",
);

/** Mirrors the TEST_FILES pattern in each app's metro.config.js. */
const TEST_FILE = /\.test\.[jt]sx?$/;

const appDirs = process.argv.slice(2);
if (appDirs.length === 0) {
  console.error("usage: node scripts/regen-router-types.mjs <app-dir> [<app-dir> ...]");
  process.exit(2);
}

let failed = false;

for (const appDir of appDirs) {
  const projectRoot = path.resolve(repoRoot, appDir);
  const appRoot = path.join(projectRoot, "app");
  const outputDir = path.join(projectRoot, ".expo", "types");

  const ctx = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
  const routeKeys = ctx.keys().filter((key) => !TEST_FILE.test(key));

  // The generator only ever calls keys(); the module getter is kept so the
  // context stays a faithful stand-in rather than a keys array in disguise.
  const routesOnly = Object.assign((key) => ctx(key), {
    keys: () => routeKeys,
    resolve: (key) => ctx.resolve(key),
    id: ctx.id,
  });

  const declaration = getTypedRoutesDeclarationFile(routesOnly);

  // An empty declaration is the failure this script exists to prevent, and it
  // is indistinguishable from success unless it is checked for: writing one
  // would break typecheck exactly as before, only now on purpose.
  if (!declaration.includes("Router.RelativePathString | Router.ExternalPathString | `/")) {
    console.error(
      `${appDir}: route discovery produced no routes from ${routeKeys.length} files. ` +
        "Not overwriting the declaration.",
    );
    failed = true;
    continue;
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "router.d.ts"), declaration);
  console.log(`${appDir}: ${routeKeys.length} routes -> .expo/types/router.d.ts`);
}

process.exit(failed ? 1 : 0);
