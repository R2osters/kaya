import { useTranslation } from "react-i18next";
import { RoutePlaceholder } from "../../src/screens/RoutePlaceholder";

/**
 * Placeholder route, task 5 (phase 1C). Names itself via @kaya/core's i18n
 * and nothing more -- the real screen lands in a later phase.
 */
export default function PasswordResetScreen() {
  const { t } = useTranslation();
  return <RoutePlaceholder title={t("screenPasswordReset")} testID="password-reset-screen" />;
}
