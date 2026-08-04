/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // src/ added in phase 1C task 2 for config/env.ts and api/client.ts and
  // their tests -- app/ alone (task 1's scope) no longer covers everything.
  roots: ["<rootDir>/app", "<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
