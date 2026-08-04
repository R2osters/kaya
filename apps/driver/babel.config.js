// react-native-reanimated's Babel plugin must be listed last: it re-exports
// react-native-worklets/plugin (see node_modules/react-native-reanimated/plugin),
// which needs to run after every other transform has produced its final
// output. A missing or misordered plugin fails silently at bundle time with
// an error that never mentions "reanimated" (this was friction #3 in the
// phase 1C task 1 report) -- verified deliberately here rather than assumed.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
