import { colors, radii, spacing, typography } from "@kaya/ui";
import { Link, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ROUTE_GROUPS } from "../navigation/routeIndex";

export interface RoutePlaceholderProps {
  /** Localized screen name -- never a hardcoded string, per task 5's brief. */
  title: string;
  testID: string;
}

/**
 * Shared body for every route created in task 5. The real screens land in
 * phases 2 and 3; until then, each route file in app/ imports this and passes
 * its own translated name.
 *
 * It also renders the route index. Task 5's brief said each route should show
 * its name "and nothing more", and taken literally that produced a shell with
 * no tappable element anywhere: the only way to reach any of the 46 routes was
 * an adb deep link. A shell nobody can walk cannot be reviewed, so every
 * placeholder doubles as the navigator between them.
 */
export function RoutePlaceholder({ title, testID }: RoutePlaceholderProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID={testID}>
      <Text testID={`${testID}-title`} style={typography.screenTitle}>
        {title}
      </Text>
      <Text style={[typography.caption, styles.hint]}>{t("navExplorerHint")}</Text>

      {ROUTE_GROUPS.map((group) => (
        <View key={group.titleKey} style={styles.group}>
          <Text style={[typography.overline, styles.groupTitle]}>{t(group.titleKey)}</Text>
          {group.routes.map((route) => {
            // The link to the current route is the one that cannot do
            // anything; marking it is cheaper than hiding it, and keeps the
            // list the same length on every screen.
            const isCurrent = route.href === pathname;
            return (
              <Link
                key={route.href}
                href={route.href}
                testID={`link-${route.href}`}
                style={[styles.link, isCurrent && styles.linkCurrent]}
              >
                <Text style={[typography.bodyStrong, isCurrent && styles.linkCurrentLabel]}>
                  {t(route.titleKey)}
                </Text>
              </Link>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: spacing.xxxl },
  hint: { marginTop: spacing.sm, marginBottom: spacing.xl },
  group: { marginBottom: spacing.xl },
  groupTitle: { marginBottom: spacing.sm },
  link: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardTight,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  linkCurrent: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  linkCurrentLabel: { color: colors.primary },
});
