import { typography } from "@kaya/ui";
import { StyleSheet, Text, View } from "react-native";

export interface RoutePlaceholderProps {
  /** Localized screen name -- never a hardcoded string, per task 5's brief. */
  title: string;
  testID: string;
}

/**
 * Shared body for every route created in task 5. The real screens land in
 * phases 2 and 3; until then, each route file in app/ imports this and
 * passes its own translated name -- nothing else. Centralizing that in one
 * component, rather than repeating the same View/Text/StyleSheet in ~20
 * files, is what keeps a later find-and-replace (once real screens arrive)
 * a one-file change instead of a twenty-file one.
 */
export function RoutePlaceholder({ title, testID }: RoutePlaceholderProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={typography.screenTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
