import { colors, shadows, spacing } from "@kaya/ui";
import { Tabs } from "expo-router";
import { Clock, Home, MessageCircle, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";

/**
 * The client's bottom tab bar. Until now the four "tab" screens were plain
 * stack screens: the `(tabs)` group had no layout, so nothing rendered a bar
 * and the only way between home, history, inbox and profile was the dev route
 * explorer. An Uber-class app lives in its tab bar; this is not chrome, it is
 * the primary navigation.
 *
 * Kept deliberately quiet: white surface, soft upward shadow, primary tint on
 * the active item only. The bar should orient, not compete with the map.
 */
export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          height: 64,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          ...shadows.sheet,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter",
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("navHome"),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("navHistory"),
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("navMessaging"),
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("navProfile"),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
