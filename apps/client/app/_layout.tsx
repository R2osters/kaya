import { KayaI18nProvider } from "@kaya/ui";
import { Stack } from "expo-router";

/**
 * Root layout. KayaI18nProvider wraps the whole route tree so every screen
 * can call useTranslation() -- see @kaya/ui's adapters/KayaI18nProvider.
 * The provider stack (query client, safe-area, auth guard) grows in later
 * phase 1C tasks; this task only proves the shell boots and the workspace
 * packages resolve.
 */
export default function RootLayout() {
  return (
    <KayaI18nProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </KayaI18nProvider>
  );
}
