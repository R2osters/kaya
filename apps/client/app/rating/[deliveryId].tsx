import { toApiFailure } from "@kaya/core";
import {
  KayaButton,
  KayaCard,
  KayaScreenHeader,
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
import { useGoBack } from "../../src/navigation/useGoBack";
import { useDelivery } from "../../src/queries/deliveries";
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
  const goBack = useGoBack();
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  // The backend wants to know *who* is being rated and checks it against the
  // delivery's participants; from this side that is always the driver. Fetched
  // rather than passed as a param so a hand-crafted link cannot rate someone
  // else, and the delivery is in cache anyway (tracking led here).
  const delivery = useDelivery(deliveryId);
  const rate = useRateDelivery(deliveryId);

  const toUserId = delivery.data?.livreurId;

  const submit = () => {
    if (score === 0 || toUserId === undefined) return;
    rate.mutate({ score, comment, toUserId }, { onSuccess: () => router.replace("/home") });
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
      <KayaScreenHeader title={t("rateTitle")} onBack={goBack} testID="rating-screen" />

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
        // Nothing to send until a score is chosen and the delivery (whose
        // driver is the ratee) has loaded; a disabled button says that better
        // than an error message after the fact.
        disabled={score === 0 || toUserId === undefined}
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
