import { currencyForCountry, formatMoney, toApiFailure, type Currency, type OrderOffer } from "@kaya/core";
import {
  EmptyState,
  KayaAvatar,
  KayaButton,
  KayaCard,
  KayaSkeletonList,
  RatingStars,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useAcceptOffer, useOffers } from "../../src/queries/offers";
import { useAuthStore } from "../../src/state/authStore";

/**
 * Offer comparison, phase 2A. Ported from
 * legacy/flutter/client/lib/features/offers/offers_screen.dart.
 *
 * The list is loaded over REST and kept current by the socket: `useOffers`
 * joins the order's room, and @kaya/core's realtime bridge turns an inbound
 * `offer:new` into an invalidation of this screen's key. Nothing here
 * subscribes to the event directly -- the write-vs-invalidate policy lives in
 * one place so a screen cannot quietly disagree with it.
 *
 * Accepting is the money moment: it locks the price and creates the delivery.
 * The mutation inherits `retry: false` and does not opt out.
 */
export default function OffersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const offers = useOffers(orderId);
  const accept = useAcceptOffer(orderId);

  // Prices are in the client's own currency: `country_configs` is keyed by
  // country and the Order model carries neither a currency nor a country. The
  // signed-in user is the only place that knows, and a client is billed in one
  // currency regardless of where the delivery runs.
  const country = useAuthStore((s) => s.user?.countryCode);
  const currency: Currency = country === undefined ? "GHS" : currencyForCountry(country);

  const error =
    accept.error === null || accept.error === undefined
      ? null
      : toApiFailure(accept.error).message;

  const rows = offers.data?.offers ?? [];

  return (
    <View style={styles.screen} testID="offers-screen">
      <Text style={typography.screenTitle} testID="offers-screen-title">
        {t("offersTitle")}
      </Text>

      {offers.data?.minPrice != null && (
        <Text style={typography.caption} testID="offers-min-price">
          {`${t("offersAppSuggested")} · ${formatMoney(offers.data.minPrice, currency)}`}
        </Text>
      )}

      {error !== null && (
        <Text style={styles.error} testID="offers-error">
          {error}
        </Text>
      )}

      {offers.isPending ? (
        <KayaSkeletonList count={3} testID="offers-loading" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={(color) => <Clock size={28} color={color} />}
          title={t("offersEmptyTitle")}
          message={t("offersEmptyBody")}
          testID="offers-empty"
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(offer) => offer.id}
          contentContainerStyle={styles.list}
          testID="offers-list"
          renderItem={({ item, index }) => (
            <OfferRow
              offer={item}
              currency={currency}
              index={index}
              disabled={accept.isPending}
              onAccept={() =>
                accept.mutate(item.id, {
                  // Routing on success only: a failed accept must not send the
                  // user to a delivery that was never created.
                  onSuccess: (delivery) => router.replace(`/tracking/${delivery.id}`),
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}

function OfferRow({
  offer,
  currency,
  index,
  disabled,
  onAccept,
}: {
  offer: OrderOffer;
  currency: Currency;
  index: number;
  disabled: boolean;
  onAccept: () => void;
}) {
  const { t } = useTranslation();

  return (
    <KayaCard testID={`offer-${index}`}>
      <View style={styles.row}>
        <KayaAvatar name={offer.livreurName} photoUrl={offer.livreurPhoto ?? undefined} />
        <View style={styles.rowText}>
          <Text style={typography.bodyStrong}>{offer.livreurName}</Text>
          <View style={styles.rating}>
            <RatingStars value={offer.livreurRating} size={14} testID={`offer-${index}-rating`} />
            <Text style={typography.caption}>
              {t("offersDeliveries", { count: offer.livreurTotalDeliveries })}
            </Text>
          </View>
        </View>
        <Text style={typography.bodyStrong} testID={`offer-${index}-price`}>
          {formatMoney(offer.proposedPrice, currency)}
        </Text>
      </View>

      <KayaButton
        label={t("offersAccept")}
        onPress={onAccept}
        disabled={disabled}
        expand
        testID={`offer-${index}-accept`}
      />
    </KayaCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  rowText: { flex: 1, gap: spacing.xs },
  rating: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  error: { ...typography.caption, color: colors.danger },
});
