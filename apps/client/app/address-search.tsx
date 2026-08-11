import { toApiFailure, type AddressSuggestion } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaSkeletonList,
  KayaTextField,
  colors,
  spacing,
  typography,
  KayaPressable,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { MapPin, Search } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {FlatList, StyleSheet, Text, View} from "react-native";
import { MIN_QUERY_LENGTH, useAddressSearch } from "../src/queries/geocoding";
import { useAddressSelectionStore } from "../src/state/addressSelectionStore";

/**
 * Address type-ahead over `GET /geocoding/search`, phase 2A.
 *
 * The result travels back through `addressSelectionStore` rather than through
 * a router param or a returned value: Expo Router navigation returns nothing,
 * and coordinates in a URL are coordinates that can be edited or restored from
 * history without ever having come from the geocoder. The delivery's price is
 * computed from them.
 *
 * Four states, per the slice's rule: the prompt (below the minimum length),
 * loading, empty, and the list. There is no separate "error" layout -- the
 * message sits above the list so a stale result stays readable while a
 * retyped query fails, which is what `placeholderData` in the hook is for.
 */
export default function AddressSearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState("");
  const select = useAddressSelectionStore((s) => s.select);

  const search = useAddressSearch(text);
  const tooShort = text.trim().length < MIN_QUERY_LENGTH;
  const results = search.data ?? [];

  const choose = (suggestion: AddressSuggestion) => {
    select(suggestion);
    // back(), not a push to /create-order: the opener may not be create-order
    // forever, and pushing would leave a second copy of it on the stack.
    router.back();
  };

  const error =
    search.error === null || search.error === undefined
      ? null
      : toApiFailure(search.error).message;

  return (
    <View style={styles.screen} testID="address-search-screen">
      <Text style={typography.screenTitle} testID="address-search-screen-title">
        {t("screenAddressSearch")}
      </Text>

      <KayaTextField
        value={text}
        onChangeText={setText}
        hint={t("addressSearchPlaceholder")}
        prefixIcon={(color) => <Search size={18} color={color} />}
        autoFocus
        testID="address-search-field"
      />

      {error !== null && (
        <Text style={styles.error} testID="address-search-error">
          {error}
        </Text>
      )}

      {tooShort ? (
        <Text style={styles.prompt} testID="address-search-prompt">
          {t("addressSearchPrompt")}
        </Text>
      ) : search.isPending ? (
        <KayaSkeletonList count={4} testID="address-search-loading" />
      ) : results.length === 0 ? (
        <EmptyState
          icon={(color) => <MapPin size={28} color={color} />}
          title={t("addressSearchEmptyTitle")}
          message={t("addressSearchEmptyBody")}
          testID="address-search-empty"
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.lat},${item.lng},${item.label}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          testID="address-search-results"
          renderItem={({ item, index }) => (
            <KayaPressable onPress={() => choose(item)} testID={`address-result-${index}`}>
              <KayaCard>
                <Text style={typography.bodyStrong}>{item.name}</Text>
                <Text style={typography.caption}>{item.label}</Text>
              </KayaCard>
            </KayaPressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  prompt: { ...typography.caption, marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.danger },
});
