import { timelineStep, type Delivery } from "@kaya/core";
import {
  EmptyState,
  KayaAvatar,
  KayaCard,
  KayaScreenHeader,
  KayaSkeletonList,
  StatusPill,
  colors,
  spacing,
  typography,
  KayaPressable,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {FlatList, StyleSheet, Text, View} from "react-native";
import { useMyDeliveries } from "../../src/queries/inbox";

/**
 * Inbox, phase 2 slice D. Ported from
 * legacy/flutter/client/lib/features/chat/inbox_screen.dart.
 *
 * A conversation exists per delivery, with the driver as the counterpart, so
 * this is a view over the user's deliveries rather than a separate resource.
 * Tapping a row opens that delivery's chat.
 */
export default function InboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const deliveries = useMyDeliveries();

  const rows = deliveries.data ?? [];

  return (
    <View style={styles.screen} testID="inbox-screen">
      <KayaScreenHeader title={t("inboxTitle")} testID="inbox-screen" />

      {deliveries.isPending ? (
        <KayaSkeletonList count={4} testID="inbox-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(color) => <MessageCircle size={28} color={color} />}
          title={t("inboxTitle")}
          message={t("inboxEmpty")}
          testID="inbox-empty"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(delivery) => delivery.id}
          contentContainerStyle={styles.list}
          testID="inbox-list"
          renderItem={({ item, index }) => (
            <ThreadRow
              delivery={item}
              index={index}
              onPress={() => router.push(`/chat/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function ThreadRow({
  delivery,
  index,
  onPress,
}: {
  delivery: Delivery;
  index: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const STEP_LABELS = ["trackEnRoute", "trackPickedUp", "trackInTransit", "trackDelivered"] as const;

  return (
    <KayaPressable onPress={onPress} testID={`inbox-thread-${index}`}>
      <KayaCard>
        <View style={styles.row}>
          <KayaAvatar
            name={delivery.driver?.fullName ?? "?"}
            photoUrl={delivery.driver?.profilePhoto ?? undefined}
          />
          <View style={styles.rowText}>
            <Text style={typography.bodyStrong}>
              {delivery.driver?.fullName ?? delivery.order?.deliveryAddress ?? delivery.orderId}
            </Text>
            <Text style={typography.caption} numberOfLines={1}>
              {delivery.order?.deliveryAddress ?? ""}
            </Text>
          </View>
          <StatusPill
            label={t(STEP_LABELS[timelineStep(delivery)])}
            testID={`inbox-thread-${index}-status`}
          />
        </View>
      </KayaCard>
    </KayaPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowText: { flex: 1 },
});
