// react-native-reanimated ships a jest mock; @kaya/ui's KayaSkeleton (and
// anything else built on reanimated) needs it under jest, same as
// packages/kaya-ui/jest.setup.js.
require("react-native-reanimated/mock");
