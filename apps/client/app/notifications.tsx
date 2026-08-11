import { type AppNotification } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaSkeletonList,
  colors,
  spacing,
  typography,
  KayaPressable,
} from "@kaya/ui";
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {FlatList, StyleSheet, Text, View} from "react-native";
import { useMarkNotificationRead, useNotifications } from "../src/queries/inbox";

/**
 * Notification feed, phase 2 slice D. Ported from
 * legacy/flutter/client/lib/features/notifications/notifications_screen.dart.
 *
 * Tapping an unread row marks it read, optimistically -- the dot clears at
 * once, and if the server disagrees the invalidation brings the truth back.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  const rows = notifications.data?.data ?? [];

  return (
    <View style={styles.screen} testID="notifications-screen">
      <Text style={typography.screenTitle} testID="notifications-screen-title">
        {t("notifTitle")}
      </Text>

      {notifications.isPending ? (
        <KayaSkeletonList count={4} testID="notifications-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(color) => <Bell size={28} color={color} />}
          title={t("notifTitle")}
          message={t("notifEmpty")}
          testID="notifications-empty"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          testID="notifications-list"
          renderItem={({ item, index }) => (
            <NotificationRow
              notification={item}
              index={index}
              onPress={() => {
                if (item.readAt === null) markRead.mutate(item.id);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

function NotificationRow({
  notification,
  index,
  onPress,
}: {
  notification: AppNotification;
  index: number;
  onPress: () => void;
}) {
  const unread = notification.readAt === null;

  return (
    <KayaPressable
      onPress={onPress}
      testID={`notification-${index}${unread ? "-unread" : ""}`}
    >
      <KayaCard>
        <View style={styles.row}>
          {/* The dot is the only unread marker; weighting the title too would
              make read rows look disabled rather than merely read. */}
          {unread && <View style={styles.dot} testID={`notification-${index}-dot`} />}
          <View style={styles.rowText}>
            <Text style={typography.bodyStrong}>{notification.title}</Text>
            <Text style={typography.caption} numberOfLines={2}>
              {notification.body}
            </Text>
          </View>
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
