// react-native-reanimated ships a jest mock; the skeleton shimmer needs it.
require("react-native-reanimated/mock");

// react-native-safe-area-context ships its own jest mock too: without it,
// any component that calls useSafeAreaInsets() (BottomSheetShell, since task
// 4) throws under Jest because there is no native SafeAreaProvider view to
// measure. The mock's useSafeAreaInsets() falls back to zero insets when no
// <SafeAreaProvider> is present in the tree, which is what every pre-existing
// test that does not wrap one still relies on.
jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default,
);
