import { currencyForCountry, formatMoney, toApiFailure, type Currency, type OrderOffer } from "@kaya/core";
import {
  EmptyState,
  KayaAnimatedListItem,
  KayaAvatar,
  KayaButton,
  KayaCard,
  KayaSkeletonList,
  KayaScreenHeader,
  RatingStars,
  colors,
  spacing,
  typography,
} from "@kaya/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useGoBack } from "../../src/navigation/useGoBack";
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
  const goBack = useGoBack();
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
      <KayaScreenHeader title={t("offersTitle")} onBack={goBack} testID="offers-screen" />

      {offers.data?.minPrice != null && (
        <Text style={typography.caption} testID="offers-min-price">
          {`${t("offersAppSuggested")} · ${formatMoney(offers.data.minPrice, currency)}`}
        </Text>
      )}

      {/* This list fills itself while the user watches it. Saying so is worth
          a line: without it, a screen that is empty for ten seconds and then
          suddenly is not reads as having been broken until it wasn't. */}
      {rows.length > 0 && (
        <Text style={typography.overline} testID="offers-live">
          {t("offersLive")}
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
                  //
                  // To payment, not to tracking. The delivery is in escrow
                  // until it is paid for; sending the client to watch a driver
                  // they have not paid skips the step the whole model rests
                  // on. Payment routes on to the receipt, and the receipt to
                  // tracking.
                  // The object form rather than a hand-built query string:
                  // concatenation widened the href to a bare `string`, which
                  // no longer typechecks against the route tree, and it left
                  // the three values unencoded. expo-router encodes them.
                  onSuccess: (delivery) =>
                    router.replace({
                      pathname: "/payment",
                      params: {
                        deliveryId: delivery.id,
                        amount: item.proposedPrice,
                        currency,
                      },
                    }),
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
    // The one list in the client app whose rows arrive on their own: a bid
    // lands over the socket, `useOffers`' key is invalidated, and a row the
    // user was not waiting for appears under their thumb. Without an entrance
    // that is indistinguishable from the list having glitched -- and the row
    // that just appeared is the one carrying a price they are about to accept.
    <KayaAnimatedListItem index={index}>
      <KayaCard testID={`offer-${index}`}>
        <View style={styles.row}>
          <KayaAvatar name={offer.livreurName} photoUrl={offer.livreurPhoto ?? undefined} />
          <View style={styles.rowText}>
            <Text style={typography.cardTitle} numberOfLines={1}>
              {offer.livreurName}
            </Text>
            <View style={styles.rating}>
              <RatingStars value={offer.livreurRating} size={14} testID={`offer-${index}-rating`} />
              <Text style={typography.caption}>
                {t("offersDeliveries", { count: offer.livreurTotalDeliveries })}
              </Text>
            </View>
          </View>
          {/* The price is what the client is choosing between, so it is the
              largest thing on the row -- a name and a star rating are how they
              break a tie, not what they are deciding. */}
          <Text style={typography.priceLarge} testID={`offer-${index}-price`}>
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
    </KayaAnimatedListItem>
  );
}

const styles = StyleSheet.create({
  // The design's screen margin is 16, not 24: on a 360dp phone the extra
  // 16 across the pair cost a fifth of the price column's width.
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  rowText: { flex: 1, gap: spacing.xs },
  rating: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  error: { ...typography.caption, color: colors.danger },
});
