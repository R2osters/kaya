/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // A previous revision mapped react-native-worklets to
  // "react-native-worklets/lib/module/mock" on the assumption that it, like
  // react-native-reanimated, ships a jest mock. It does not — its `__mocks__`
  // source directory is deliberately excluded from the published package —
  // so that mapping pointed at a file that can never exist, and broke every
  // test in this package the moment the dependency was actually installed
  // (it previously was not, which is why this went unnoticed). The real
  // module's init() already falls back gracefully with no native binding
  // present under jest, so no mapping is needed at all.
};
