import { toApiFailure } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaTextField,
  RatingStars,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useRateDelivery } from "../../src/queries/ratings";

/**
 * Rate a completed delivery, phase 2 slice D. Ported from
 * legacy/flutter/client/lib/features/rating/rating_screen.dart.
 *
 * The stars start unset rather than at five. A pre-filled rating is a rating
 * the platform wrote: a user who taps submit without thinking has given a
 * five-star review they never chose, and on a marketplace where a driver's
 * score decides how much work they get, that is not a harmless default.
 */
export default function RatingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const rate = useRateDelivery(deliveryId);

  const submit = () => {
    if (score === 0) return;
    rate.mutate({ score, comment }, { onSuccess: () => router.replace("/home") });
  };

  const error =
    rate.error === null || rate.error === undefined ? null : toApiFailure(rate.error).message;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="rating-screen"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={typography.screenTitle} testID="rating-screen-title">
        {t("rateTitle")}
      </Text>

      <KayaCard testID="rating-card">
        <RatingStars value={score} onRate={setScore} size={36} testID="rating-stars" />
      </KayaCard>

      <KayaTextField
        value={comment}
        onChangeText={setComment}
        hint={t("rateComment")}
        multiline
        testID="rating-comment"
      />

      {error !== null && (
        <Text style={styles.error} testID="rating-error">
          {error}
        </Text>
      )}

      <KayaButton
        label={t("rateSubmit")}
        onPress={submit}
        loading={rate.isPending}
        // Nothing to send until a score is chosen, and a disabled button says
        // that better than an error message after the fact.
        disabled={score === 0}
        expand
        testID="rating-submit"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  error: { ...typography.caption, color: colors.danger },
});
