import { toApiFailure, type Message } from "@kaya/core";
import {
  EmptyState,
  KayaButton,
  KayaSkeletonList,
  KayaScreenHeader,
  KayaTextField,
  colors,
  radii,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
import { useMessages, useSendMessage } from "../../src/queries/messages";
import { useAuthStore } from "../../src/state/authStore";

/**
 * Delivery chat, phase 3. The client app's screen, unchanged: one thread
 * per delivery, read from the other end. Sides are decided by comparing the
 * sender to the signed-in user, which is exactly what makes the same file
 * correct for both apps.
 *
 * Inbound messages arrive through the socket and are appended to the cache by
 * @kaya/core's policy; this screen only reads the same key. Outbound ones go
 * over REST -- see useSendMessage for why an emit is not good enough for the
 * thing the sender is watching.
 *
 * Sides are decided by comparing the sender to the signed-in user, not by a
 * flag on the message: the backend has no notion of "mine", and a client and
 * a driver read the same thread from opposite ends.
 */
export default function ChatScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();

  const messages = useMessages(deliveryId);
  const send = useSendMessage(deliveryId);
  const userId = useAuthStore((s) => s.user?.id);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (text === "") return;
    // Cleared optimistically: the composer emptying is the feedback that the
    // message left, and a failure surfaces below rather than by silently
    // restoring what was typed.
    setDraft("");
    send.mutate(text);
  };

  const error =
    send.error === null || send.error === undefined ? null : toApiFailure(send.error).message;

  const rows = messages.data ?? [];

  return (
    <View style={styles.screen} testID="chat-screen">
      <KayaScreenHeader title={t("screenChat")} onBack={goBack} testID="chat-screen" />

      {messages.isPending ? (
        <KayaSkeletonList count={4} testID="chat-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(color) => <MessageCircle size={28} color={color} />}
          title={t("chatHint")}
          testID="chat-empty"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(message) => message.id}
          contentContainerStyle={styles.list}
          testID="chat-list"
          renderItem={({ item, index }) => (
            <Bubble message={item} mine={item.senderId === userId} index={index} />
          )}
        />
      )}

      {error !== null && (
        <Text style={styles.error} testID="chat-error">
          {error}
        </Text>
      )}

      <View style={styles.composer}>
        <View style={styles.composerField}>
          <KayaTextField
            value={draft}
            onChangeText={setDraft}
            hint={t("chatHint")}
            testID="chat-input"
          />
        </View>
        <KayaButton
          label={t("actionChat")}
          onPress={submit}
          loading={send.isPending}
          testID="chat-send"
        />
      </View>
    </View>
  );
}

function Bubble({ message, mine, index }: { message: Message; mine: boolean; index: number }) {
  return (
    <View
      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
      testID={`chat-message-${index}${mine ? "-mine" : ""}`}
    >
      <Text style={mine ? styles.bubbleMineText : typography.body}>
        {message.messageText ?? ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  bubble: {
    maxWidth: "80%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.cardTight,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleMineText: { ...typography.body, color: colors.surface },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.surface },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  composerField: { flex: 1 },
  error: { ...typography.caption, color: colors.danger },
});
