import { colors, shadows, spacing } from "@kaya/ui";
import { Tabs } from "expo-router";
import { Clock, Home, MessageCircle, User } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // React Navigation 7 ships bottom tabs with `animation: "none"`, so
        // every tab change was a hard cut: the screen the user left and the
        // one they arrived at had no relationship on screen, and on a slow
        // first render the cut reads as a stall. "shift" moves the outgoing
        // screen out in the direction of travel, which is the cheapest way to
        // say the four tabs sit side by side rather than on top of each other.
        animation: "shift",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          // The gesture bar owns the bottom edge; a fixed height puts labels
          // under it. Verified on the emulator before this inset existed.
          height: 60 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
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
