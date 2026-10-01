import { toApiFailure, type AddressSuggestion } from "@kaya/core";
import {
  EmptyState,
  KayaCard,
  KayaSkeletonList,
  KayaScreenHeader,
  KayaTextField,
  colors,
  spacing,
  typography,
  KayaPressable,
  useDeviceLocation,
} from "@kaya/ui";
import { useRouter } from "expo-router";
import { Crosshair, MapPin, Search } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {FlatList, StyleSheet, Text, View} from "react-native";
import { useGoBack } from "../src/navigation/useGoBack";
import {
  MIN_QUERY_LENGTH,
  useAddressSearch,
  useReverseGeocode,
} from "../src/queries/geocoding";
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
  const goBack = useGoBack();
  const router = useRouter();
  const [text, setText] = useState("");
  const select = useAddressSelectionStore((s) => s.select);

  const search = useAddressSearch(text);
  const tooShort = text.trim().length < MIN_QUERY_LENGTH;
  const results = search.data ?? [];

  // Not requested on mount: this screen works perfectly by typing, and a
  // permission prompt the moment it opens interrupts someone who is already
  // reaching for the keyboard. The button below is the ask.
  const location = useDeviceLocation();
  const reverse = useReverseGeocode();
  const locating = reverse.isPending;

  /**
   * "Use my position": permission, a fix, then a name for it.
   *
   * The address is a label; the coordinate is what the delivery is priced and
   * routed from. So a reverse-geocode that finds nothing -- or fails -- still
   * selects the position, under a generic label. Refusing to proceed would
   * throw away a perfectly good pickup point because nobody has mapped the
   * street yet, which in peri-urban Accra is most of them.
   */
  const useMyPosition = async () => {
    const granted =
      location.permission === "granted" ? "granted" : await location.request();
    if (granted !== "granted") return;

    const point = location.position ?? null;
    if (point === null) return;

    const named = await reverse.mutateAsync(point).catch(() => null);
    select(
      named ?? {
        label: t("addressMyPosition"),
        name: t("addressMyPosition"),
        city: null,
        countryCode: null,
        lat: point.lat,
        lng: point.lng,
      },
    );
    router.back();
  };

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
      <KayaScreenHeader title={t("screenAddressSearch")} onBack={goBack} testID="address-search-screen" />

      <KayaTextField
        value={text}
        onChangeText={setText}
        hint={t("addressSearchPlaceholder")}
        prefixIcon={(color) => <Search size={18} color={color} />}
        autoFocus
        testID="address-search-field"
      />

      <KayaPressable
        onPress={() => void useMyPosition()}
        style={styles.myPosition}
        testID="address-use-my-position"
      >
        <Crosshair size={18} color={colors.primary} />
        <Text style={[typography.bodyStrong, styles.myPositionLabel]}>
          {locating ? t("addressLocatingYou") : t("addressUseMyPosition")}
        </Text>
      </KayaPressable>

      {location.permission === "denied" && (
        <Text style={styles.prompt} testID="address-location-denied">
          {t("addressLocationRefused")}
        </Text>
      )}

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
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  prompt: { ...typography.caption, marginTop: spacing.sm },
  myPosition: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  myPositionLabel: { color: colors.primary },
  error: { ...typography.caption, color: colors.danger },
});
