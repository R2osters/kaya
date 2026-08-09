/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // No custom testMatch: an explicit "<rootDir>/**" glob mixes path separators
  // on Windows and matches nothing here. Jest's default pattern works.
  moduleFileExtensions: ["ts", "js", "json"],
};
