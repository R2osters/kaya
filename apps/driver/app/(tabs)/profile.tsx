import { COUNTRIES, currencyForCountry, formatMoney } from "@kaya/core";
import {
  KayaAvatar,
  KayaButton,
  KayaCard,
  KayaPressable,
  RatingStars,
  KayaScreenHeader,
  StatusPill,
  colors,
  radii,
  spacing,
  typography,
  useLocale,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { BarChart3, ChevronRight, Clock, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../../src/state/authStore";
import { useLocaleStore } from "../../src/state/localeStore";

/**
 * Profile, phase 3. Ported from
 * legacy/flutter/driver/lib/features/profile/profile_screen.dart.
 *
 * The client's profile with the driver's own things added: the rating that
 * decides how much work they are offered (`ratingDriver`, not
 * `ratingClient`), and the three screens that belong to nothing else --
 * history, stats, documents.
 *
 * Everything here reads the user the auth store already holds. No fetch, no
 * loading state: a signed-in session always has one, because restoreSession
 * resolves it before the guard lets anyone in.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { locale } = useLocale();
  const setLocale = useLocaleStore((s) => s.setLocale);

  if (user === null) return null;

  const country = COUNTRIES[user.countryCode];
  const currency = currencyForCountry(user.countryCode);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="profile-screen"
    >
      <KayaScreenHeader title={t("profileTitle")} testID="profile-screen" />

      <KayaCard testID="profile-identity">
        <View style={styles.identity}>
          <KayaAvatar
            name={user.fullName}
            photoUrl={user.profilePhoto ?? undefined}
            size={64}
            ring
          />
          <View style={styles.identityText}>
            <Text style={typography.bodyStrong} testID="profile-name">
              {user.fullName}
            </Text>
            <Text style={typography.caption} testID="profile-phone">
              {user.phone}
            </Text>
            {user.isVerified && (
              <StatusPill label={t("profileVerified")} tone="success" testID="profile-verified" />
            )}
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            {/* The driver's own score, given by clients. `ratingClient` is
                what they scored as a customer, which is not what decides how
                much work they see. */}
            <RatingStars value={user.ratingDriver} size={14} testID="profile-rating" />
            <Text style={typography.caption}>{t("profileRating")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={typography.bodyStrong} testID="profile-deliveries">
              {t("profileDeliveries", { count: String(user.totalDeliveries) })}
            </Text>
            <Text style={typography.caption} testID="profile-balance">
              {formatMoney(user.balance, currency)}
            </Text>
          </View>
        </View>
      </KayaCard>

      <KayaCard padding={0} testID="profile-links">
        <LinkRow
          icon={(color) => <Clock size={18} color={color} />}
          label={t("screenHistory")}
          onPress={() => router.push("/history")}
          testID="profile-history"
        />
        <View style={styles.separator} />
        <LinkRow
          icon={(color) => <BarChart3 size={18} color={color} />}
          label={t("driverStats")}
          onPress={() => router.push("/stats")}
          testID="profile-stats"
        />
        <View style={styles.separator} />
        <LinkRow
          icon={(color) => <ShieldCheck size={18} color={color} />}
          label={t("driverVerifyDocuments")}
          onPress={() => router.push("/verify-documents")}
          testID="profile-documents"
        />
      </KayaCard>

      <KayaCard testID="profile-country">
        <Text style={typography.caption}>{t("profileCountryCurrency")}</Text>
        <Text style={typography.bodyStrong} testID="profile-country-value">
          {`${country.flag} ${country.displayName} · ${currency}`}
        </Text>
      </KayaCard>

      <KayaCard testID="profile-language">
        <View style={styles.langRow}>
          {(["fr", "en"] as const).map((lang) => (
            <KayaPressable
              key={lang}
              onPress={() => {
                void setLocale(lang);
              }}
              style={[styles.lang, locale === lang && styles.langSelected]}
              testID={`profile-lang-${lang}`}
            >
              <Text style={[typography.body, locale === lang && styles.langSelectedLabel]}>
                {lang === "fr" ? "Français" : "English"}
              </Text>
            </KayaPressable>
          ))}
        </View>
      </KayaCard>

      <KayaButton
        label={t("authLogout")}
        variant="danger"
        onPress={() => {
          void signOut();
        }}
        expand
        testID="profile-logout"
      />
    </ScrollView>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: (color: string) => React.ReactNode;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <KayaPressable onPress={onPress} style={styles.linkRow} testID={testID}>
      {icon(colors.primary)}
      <Text style={[typography.body, styles.linkLabel]}>{label}</Text>
      <ChevronRight size={18} color={colors.inkTertiary} />
    </KayaPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.md, paddingBottom: spacing.xxxl },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.xs, alignItems: "flex-start" },
  stats: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.xxl },
  stat: { gap: spacing.xs },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  linkLabel: { flex: 1 },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginHorizontal: spacing.lg },
  langRow: { flexDirection: "row", gap: spacing.sm },
  lang: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  langSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  langSelectedLabel: { color: colors.primary },
});
