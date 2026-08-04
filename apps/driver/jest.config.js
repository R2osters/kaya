/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/app"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
