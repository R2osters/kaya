import { StyleSheet, View } from "react-native";
import { spacing } from "../theme";
import { KayaSkeleton } from "./KayaSkeleton";

export interface KayaSkeletonCardProps {
  /**
   * Announced by a screen reader while this stands in for content, e.g.
   * "Chargement des courses". Without it this is an `accessible` node with
   * nothing to read: the child boxes are deliberately hidden from the
   * accessibility tree, so a blind user focuses it and hears silence — no
   * different from an empty list. Copy comes from the caller's i18n, never
   * from this package.
   */
  accessibilityLabel?: string;
  testID?: string;
}

const TITLE_WIDTH = 160;
const TITLE_HEIGHT = 18;
const BODY_HEIGHT = 14;
const BODY_LAST_WIDTH = 200;
const FOOTER_WIDTH = 80;
const FOOTER_HEIGHT = 32;

/**
 * The standard stand-in for a single-item screen (delivery detail, stats,
 * profile header): a title line, three body lines of decreasing width, and
 * a footer action row. Ported from `KayaSkeletonCard` in kaya_skeleton.dart.
 *
 * The Dart original is plain `Padding` + `Column` with no card
 * decoration of its own (no background, border, or shadow) — it is meant to
 * stand in for whatever content will eventually occupy the space, not to
 * add chrome around it. So this does not wrap itself in `KayaCard`; a
 * caller that wants the card surface composes `KayaCard` around this the
 * same way it will compose it around the real content once loaded.
 *
 * Accessibility: announces `busy` once at this root and groups its six
 * child skeleton boxes out of the accessibility tree, same reasoning as
 * `KayaSkeletonListTile` — one "loading" announcement for the whole card
 * rather than one per line.
 */
export function KayaSkeletonCard({ accessibilityLabel, testID }: KayaSkeletonCardProps) {
  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityLabel !== undefined ? { busy: true } : undefined}
      // Android needs this to keep the child boxes out of the tree.
      // iOS needs nothing: `accessible` already merges descendants into
      // a single element there.
      importantForAccessibility="no-hide-descendants"
      style={styles.card}
    >
      <KayaSkeleton width={TITLE_WIDTH} height={TITLE_HEIGHT} testID={testID ? `${testID}-title` : undefined} />
      <View style={styles.body}>
        <KayaSkeleton height={BODY_HEIGHT} testID={testID ? `${testID}-body-1` : undefined} />
        <View style={styles.bodyLine}>
          <KayaSkeleton height={BODY_HEIGHT} testID={testID ? `${testID}-body-2` : undefined} />
        </View>
        <View style={styles.bodyLine}>
          <KayaSkeleton
            width={BODY_LAST_WIDTH}
            height={BODY_HEIGHT}
            testID={testID ? `${testID}-body-3` : undefined}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <KayaSkeleton
          width={FOOTER_WIDTH}
          height={FOOTER_HEIGHT}
          testID={testID ? `${testID}-footer-1` : undefined}
        />
        <View style={styles.footerGap}>
          <KayaSkeleton
            width={FOOTER_WIDTH}
            height={FOOTER_HEIGHT}
            testID={testID ? `${testID}-footer-2` : undefined}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg },
  body: { marginTop: spacing.lg },
  bodyLine: { marginTop: spacing.sm },
  footer: { flexDirection: "row", marginTop: spacing.xl },
  footerGap: { marginLeft: spacing.md },
});
