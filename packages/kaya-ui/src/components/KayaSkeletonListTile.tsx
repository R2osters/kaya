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
 * Android. The child boxes (via `SkeletonListTileRow`) are never given their
 * own `accessibilityLabel`, so `KayaSkeleton` does not self-announce for any
 * of them today — but the grouping is what actually guarantees a screen
 * reader hears "loading" exactly once per row, rather than depending on that
 * staying true. Without it, a future box that does pick up a label would
 * leak a second, redundant announcement into this row.
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
