/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // react-native-reanimated's own jest mock still imports the real module
  // graph, which pulls in react-native-worklets' native binding. Redirect
  // worklets to its own mock so nothing needs native init under jest.
  moduleNameMapper: {
    "^react-native-worklets$": "react-native-worklets/lib/module/mock",
  },
};
