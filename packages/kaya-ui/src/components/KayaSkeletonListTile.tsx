import { View } from "react-native";
import { SkeletonListTileRow } from "./skeletonListTileRow";

export interface KayaSkeletonListTileProps {
  testID?: string;
}

/**
 * One skeleton row: leading avatar circle, two stacked text lines, a
 * trailing chip. Matches the shape of a typical list row across both apps
 * (order, delivery, notification, inbox rows). Ported from
 * `KayaSkeletonListTile` in kaya_skeleton.dart.
 *
 * Accessibility: announces `busy` once at this root, and groups its four
 * child skeleton boxes out of the accessibility tree — `accessible`
 * collapses the subtree into a single node on iOS, and
 * `importantForAccessibility="no-hide-descendants"` does the equivalent on
 * Android. Without this, a screen reader would hear "loading" once per box
 * (KayaSkeleton always announces `busy` on itself) instead of once per row.
 */
export function KayaSkeletonListTile({ testID }: KayaSkeletonListTileProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityState={{ busy: true }}
      importantForAccessibility="no-hide-descendants"
    >
      <SkeletonListTileRow testID={testID ? `${testID}-row` : undefined} />
    </View>
  );
}
