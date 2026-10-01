import { COUNTRIES, formatMoney, currencyForCountry } from "@kaya/core";
import {
  KayaAvatar,
  KayaButton,
  KayaCard,
  RatingStars,
  KayaScreenHeader,
  StatusPill,
  colors,
  radii,
  spacing,
  typography,
  useLocale,
  KayaPressable,
} from "@kaya/ui";
import { useTranslation } from "react-i18next";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import { useAuthStore } from "../../src/state/authStore";
import { useLocaleStore } from "../../src/state/localeStore";

/**
 * Profile, phase 2 slice D. Ported from
 * legacy/flutter/client/lib/features/profile/profile_screen.dart.
 *
 * Everything here reads the user the auth store already holds -- no fetch, no
 * loading state: a signed-in session always has a user, because restoreSession
 * resolves one before the guard lets anyone in.
 *
 * Sign-out clears the keychain through the store; the route guard reacts to
 * the status flip and lands on welcome. The screen itself navigates nowhere.
 *
 * The Dart original's "Addresses" and "Payment methods" tiles are not ported:
 * both routes led to screens that do not exist on this backend (no saved-
 * address or payment-method resource). Dead doors say the app is broken.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
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
          <KayaAvatar name={user.fullName} photoUrl={user.profilePhoto ?? undefined} size={64} ring />
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
            <RatingStars value={user.ratingClient} size={14} testID="profile-rating" />
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

      <KayaCard testID="profile-country">
        <Text style={typography.caption}>{t("profileCountryCurrency")}</Text>
        <Text style={typography.bodyStrong} testID="profile-country-value">
          {`${country.flag} ${country.displayName} · ${currency}`}
        </Text>
      </KayaCard>

      {/* Language toggle, ported from widgets/language_toggle.dart. The store
          persists the choice; KayaI18nProvider follows it live. */}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.xs, alignItems: "flex-start" },
  stats: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.xxl },
  stat: { gap: spacing.xs },
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
