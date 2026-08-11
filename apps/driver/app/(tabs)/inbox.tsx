import { timelineStep, type Delivery } from "@kaya/core";
import {
  EmptyState,
  KayaAvatar,
  KayaCard,
  KayaPressable,
  KayaScreenHeader,
  KayaSkeletonList,
  StatusPill,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useMyDeliveries } from "../../src/queries/deliveries";

const STEP_LABELS = ["trackEnRoute", "trackPickedUp", "trackInTransit", "trackDelivered"] as const;

/**
 * Inbox, phase 3. The client app's inbox seen from the other end: one thread
 * per delivery, with the *client* as the counterpart.
 *
 * The name shown is real now. `GET /deliveries` used to include only the
 * order, so both apps rendered a counterpart that was always null and fell
 * back to an address where a name belongs -- see PARTICIPANT_SELECT in
 * backend/src/deliveries/deliveries.service.ts.
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
  const client = delivery.order?.client ?? null;

  return (
    <KayaPressable onPress={onPress} testID={`inbox-thread-${index}`}>
      <KayaCard>
        <View style={styles.row}>
          <KayaAvatar
            name={client?.fullName ?? "?"}
            photoUrl={client?.profilePhoto ?? undefined}
          />
          <View style={styles.rowText}>
            <Text style={typography.bodyStrong} numberOfLines={1}>
              {client?.fullName ?? delivery.order?.deliveryAddress ?? delivery.orderId}
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
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowText: { flex: 1 },
});
