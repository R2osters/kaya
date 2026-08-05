// react-native-reanimated ships a jest mock; @kaya/ui's KayaSkeleton (and
// anything else built on reanimated) needs it under jest, same as
// packages/kaya-ui/jest.setup.js.
require("react-native-reanimated/mock");

// react-native-safe-area-context ships its own jest mock too: app/_layout.tsx
// (task 4) wraps the whole tree in a real SafeAreaProvider, which throws
// under Jest with no native view to measure without this. Same wiring as
// packages/kaya-ui/jest.setup.js.
jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default,
);
