import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { SkeletonListTileRow } from "./skeletonListTileRow";

export interface KayaSkeletonListProps {
  count?: number;
  testID?: string;
}

const DEFAULT_COUNT = 4;

/**
 * The standard stand-in for a list-shaped `loading:` branch: repeats the
 * list-tile row `count` times inside a padded container. Ported from
 * `KayaSkeletonList` in kaya_skeleton.dart, which used `ListView.builder`
 * for virtualized scrolling; here the rows are rendered directly in a plain
 * `View` since skeleton counts are small (a handful of placeholder rows) and
 * this loading state normally already sits inside a screen-level scroll
 * container — virtualizing a decorative placeholder buys nothing.
 *
 * Accessibility: `KayaSkeletonListTile` announces `busy` at its own root
 * when used standalone (see that component). Reusing it here, once per row,
 * would repeat the "loading" announcement `count` times for what is, to the
 * user, a single loading list — worse than useless, per the design brief.
 * So this component renders the bare rows directly (no per-row
 * accessibility grouping) and announces `busy` exactly once, at the list's
 * own root.
 */
export function KayaSkeletonList({ count = DEFAULT_COUNT, testID }: KayaSkeletonListProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityState={{ busy: true }}
      importantForAccessibility="no-hide-descendants"
      style={styles.list}
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonListTileRow key={index} testID={testID ? `${testID}-tile-${index}` : undefined} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
});
