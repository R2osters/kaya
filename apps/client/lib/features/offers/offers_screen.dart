import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import 'offers_provider.dart';

class OffersScreen extends ConsumerWidget {
  const OffersScreen({super.key, required this.orderId});
  final String orderId;

  Future<void> _cancelOrder(
      BuildContext context, WidgetRef ref, KayaL10n l10n) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(l10n.orderCancelTitle),
        content: Text(l10n.orderCancelConfirm),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(l10n.actionClose)),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(l10n.actionConfirm)),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(kayaApiProvider).orders.cancel(orderId);
      if (context.mounted) context.go('/home');
    } on ApiFailure catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _accept(BuildContext context, WidgetRef ref, Offer offer) async {
    final controller = ref.read(offersControllerProvider(orderId).notifier);
    try {
      final delivery = await controller.accept(offer.id);
      if (context.mounted) context.pushReplacement('/payment', extra: delivery);
    } on ApiFailure catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final state = ref.watch(offersControllerProvider(orderId));
    final currency = ref.watch(currentUserProvider)?.currency ?? Currency.GHS;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.offersTitle),
        actions: [
          TextButton(
            onPressed: () => _cancelOrder(context, ref, l10n),
            child: Text(l10n.actionCancel,
                style: const TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () =>
              ref.read(offersControllerProvider(orderId).notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _SuggestedPriceCard(
                minPrice: state.order?.minPriceSuggested,
                currency: currency,
                l10n: l10n,
              ),
              const SizedBox(height: 24),
              Text(l10n.offersTitle, style: AppTypography.sectionTitle),
              const SizedBox(height: 12),
              if (state.loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (state.offers.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  child: Column(
                    children: [
                      const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.4)),
                      const SizedBox(height: 16),
                      Text(l10n.offersAwaiting,
                          style: AppTypography.bodySecondary),
                    ],
                  ),
                )
              else
                ...state.offers.map((o) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: _OfferCard(
                        offer: o,
                        currency: currency,
                        l10n: l10n,
                        onAccept: () => _accept(context, ref, o),
                      ),
                    )),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuggestedPriceCard extends StatelessWidget {
  const _SuggestedPriceCard({
    required this.minPrice,
    required this.currency,
    required this.l10n,
  });

  final double? minPrice;
  final Currency currency;
  final KayaL10n l10n;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      color: AppColors.background,
      border: false,
      shadow: false,
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.payments_rounded,
                    color: AppColors.surface),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.offersAppSuggested,
                        style: AppTypography.bodySecondary),
                    const SizedBox(height: 2),
                    Text(
                      minPrice == null
                          ? '—'
                          : Money(minPrice!, currency).format(),
                      style: AppTypography.priceLarge,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(l10n.offersAwaiting.toUpperCase(),
              style: AppTypography.overline),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            child: const LinearProgressIndicator(
              minHeight: 4,
              backgroundColor: AppColors.border,
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.offer,
    required this.currency,
    required this.l10n,
    required this.onAccept,
  });

  final Offer offer;
  final Currency currency;
  final KayaL10n l10n;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final driver = offer.driver;
    final rating = driver?.ratingDriver ?? 5.0;
    final trips = driver?.totalDeliveries ?? 0;

    return KayaCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KayaAvatar(
              photoUrl: driver?.profilePhoto, name: driver?.fullName, radius: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(driver?.fullName ?? 'Livreur',
                    style: AppTypography.cardTitle),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.star_rounded,
                        size: 16, color: AppColors.amber),
                    const SizedBox(width: 4),
                    Text(
                      '${rating.toStringAsFixed(1)} (${l10n.offersTrips(trips >= 100 ? "${(trips ~/ 100) * 100}+" : "$trips")})',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.access_time_rounded,
                        size: 15, color: AppColors.inkTertiary),
                    const SizedBox(width: 4),
                    Text(l10n.offersMinAway('${(offer.proposedPrice % 5).round() + 2}'),
                        style: AppTypography.caption),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(Money(offer.proposedPrice, currency).format(),
                  style: AppTypography.price),
              const SizedBox(height: 8),
              KayaButton(
                label: l10n.actionAccept,
                expand: false,
                onPressed: onAccept,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
