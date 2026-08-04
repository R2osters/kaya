import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { KayaSkeleton } from "./KayaSkeleton";

const AVATAR_SIZE = 44;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
// Gap either side of the text column (avatar→text, text→chip). Not on the
// 4pt spacing grid — matches the Dart `SizedBox(width: 14)` exactly.
const SIDE_GAP = 14;
// Not on the spacing grid either — matches the Dart tile's own
// `EdgeInsets.symmetric(vertical: 10)`.
const VERTICAL_PADDING = 10;
const TITLE_LINE_HEIGHT = 14;
const SUBTITLE_LINE_HEIGHT = 12;
const SUBTITLE_WIDTH = 120;
const CHIP_WIDTH = 48;
const CHIP_HEIGHT = 20;

export interface SkeletonListTileRowProps {
  testID?: string;
}

/**
 * Bare visual row for one skeleton list item: leading avatar circle, two
 * stacked text lines, a trailing chip. Ported from `KayaSkeletonListTile` in
 * kaya_skeleton.dart.
 *
 * This is intentionally not exported from the package barrel and carries no
 * accessibility props of its own — `KayaSkeletonListTile` and
 * `KayaSkeletonList` each decide, at their own root, where `busy` gets
 * announced, so the row underneath stays a plain, unannounced visual.
 */
export function SkeletonListTileRow({ testID }: SkeletonListTileRowProps) {
  return (
    <View testID={testID} style={styles.row}>
      <KayaSkeleton
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        radius={AVATAR_RADIUS}
        testID={testID ? `${testID}-avatar` : undefined}
      />
      <View style={styles.text}>
        <KayaSkeleton height={TITLE_LINE_HEIGHT} testID={testID ? `${testID}-line-1` : undefined} />
        <View style={styles.lineGap}>
          <KayaSkeleton
            width={SUBTITLE_WIDTH}
            height={SUBTITLE_LINE_HEIGHT}
            testID={testID ? `${testID}-line-2` : undefined}
          />
        </View>
      </View>
      <KayaSkeleton width={CHIP_WIDTH} height={CHIP_HEIGHT} testID={testID ? `${testID}-chip` : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: VERTICAL_PADDING },
  // marginRight here doubles as the gap in front of the trailing chip, so
  // the chip itself needs no margin of its own.
  text: { flex: 1, marginLeft: SIDE_GAP, marginRight: SIDE_GAP },
  lineGap: { marginTop: spacing.sm },
});
