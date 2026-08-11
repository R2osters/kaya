import { colors, shadows, spacing } from "@kaya/ui";
import { Tabs } from "expo-router";
import { Home, MessageCircle, User, Wallet } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The driver's bottom tab bar. Same construction as the client's, and
 * deliberately so: two apps that look like siblings cost a driver who also
 * orders deliveries nothing to learn twice.
 *
 * The four destinations are the driver's day: work (home), money (earnings),
 * the client they are talking to (inbox), and their own account. Everything
 * else -- a run, a bid, a withdrawal -- is pushed on top of one of these.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
          // The gesture bar owns the bottom edge; a fixed height puts the
          // labels under it (verified on the emulator for the client app).
          height: 60 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          ...shadows.sheet,
        },
        tabBarLabelStyle: { fontFamily: "Inter", fontSize: 11, fontWeight: "600" },
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
        name="earnings"
        options={{
          title: t("navEarnings"),
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
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
