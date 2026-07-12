import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';
import 'nearby_provider.dart';
import 'new_request_popup.dart';

class DriverHomeScreen extends ConsumerStatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  ConsumerState<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends ConsumerState<DriverHomeScreen> {
  StreamSubscription<GeoPoint>? _locSub;
  bool _busy = false;

  // Auto-popup bookkeeping: ids already seen (so we only surface a request the
  // first time it appears), and whether we've seeded from the initial load.
  final Set<String> _seenRequests = {};
  bool _seededRequests = false;
  bool _popupOpen = false;

  @override
  void dispose() {
    _locSub?.cancel();
    super.dispose();
  }

  Future<void> _toggleOnline(bool online) async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).setOnline(online);
      if (online) {
        await _startLocationStream();
        ref.invalidate(nearbyOrdersProvider);
      } else {
        await _locSub?.cancel();
        _locSub = null;
      }
    } on ApiFailure catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _startLocationStream() async {
    final location = ref.read(locationServiceProvider);
    if (!await location.ensurePermission()) return;
    final socket = ref.read(socketServiceProvider);
    _locSub = location.stream().listen((p) {
      socket.sendLocation(p.lat, p.lng); // ~5s ticks -> gateway
    });
  }

  Future<void> _openRequest(Order order, Currency currency) async {
    if (_popupOpen) return;
    _popupOpen = true;
    final accepted = await NewRequestPopup.show(context, order, currency);
    _popupOpen = false;
    if (accepted == true && mounted) {
      context.push('/propose/${order.id}');
    }
  }

  /// Surfaces the countdown popup automatically the first time a new nearby
  /// order appears while the driver is online. (The gateway has no driver-facing
  /// new-order socket event; nearby polling + FCM push are the v1 mechanisms.)
  void _watchForNewRequests(Currency currency) {
    ref.listen(nearbyOrdersProvider, (_, next) {
      next.whenData((orders) {
        if (!_seededRequests) {
          _seenRequests.addAll(orders.map((o) => o.id));
          _seededRequests = true;
          return;
        }
        final online = ref.read(currentUserProvider)?.isOnline ?? false;
        if (!online || _popupOpen) return;
        for (final o in orders) {
          if (_seenRequests.add(o.id)) {
            _openRequest(o, currency);
            break;
          }
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);
    final online = user?.isOnline ?? false;
    final currency = user?.currency ?? Currency.GHS;
    final nearby = ref.watch(nearbyOrdersProvider);
    final stats = ref.watch(driverStatsProvider);

    _watchForNewRequests(currency);

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: MapView.build2(showUserLocation: true),
          ),
          SafeArea(
            child: Column(
              children: [
                // Header: brand + online toggle + bell.
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: KayaCard(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(kAppName,
                                  style: AppTypography.cardTitle
                                      .copyWith(color: AppColors.primary)),
                              const SizedBox(height: 2),
                              Text(
                                online ? l10n.driverOnline : l10n.driverOffline,
                                style: AppTypography.caption.copyWith(
                                  color: online
                                      ? AppColors.success
                                      : AppColors.inkTertiary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        _busy
                            ? const SizedBox(
                                width: 40,
                                child: Center(
                                    child: SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2))))
                            : Switch(
                                value: online,
                                activeColor: AppColors.success,
                                onChanged: _toggleOnline,
                              ),
                        IconButton(
                          icon: const Icon(Icons.notifications_none_rounded),
                          onPressed: () => context.push('/notifications'),
                        ),
                      ],
                    ),
                  ),
                ),
                // Today's earnings.
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: KayaCard(
                    color: AppColors.primary,
                    border: false,
                    child: Row(
                      children: [
                        const Icon(Icons.today_rounded,
                            color: AppColors.surface),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(l10n.driverTodayEarnings,
                              style: AppTypography.bodyStrong
                                  .copyWith(color: AppColors.surface)),
                        ),
                        Text(
                          stats.maybeWhen(
                            data: (s) => Money(
                                    (s['todayEarnings'] as num?)?.toDouble() ?? 0,
                                    currency)
                                .format(),
                            orElse: () => '—',
                          ),
                          style: AppTypography.price
                              .copyWith(color: AppColors.surface),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                // Nearby requests sheet.
                Container(
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.vertical(
                        top: Radius.circular(AppRadii.sheet)),
                    boxShadow: AppShadows.sheet,
                  ),
                  constraints: BoxConstraints(
                      maxHeight: MediaQuery.of(context).size.height * 0.4),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 44,
                          height: 5,
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(l10n.driverNearbyRequests,
                          style: AppTypography.sectionTitle),
                      const SizedBox(height: 12),
                      Flexible(
                        child: !online
                            ? _hint(l10n.driverOffline)
                            : nearby.when(
                                loading: () => const Center(
                                    child: Padding(
                                  padding: EdgeInsets.all(24),
                                  child: CircularProgressIndicator(),
                                )),
                                error: (_, __) => _hint(l10n.commonError),
                                data: (orders) => orders.isEmpty
                                    ? _hint(l10n.commonEmpty)
                                    : ListView.builder(
                                        shrinkWrap: true,
                                        itemCount: orders.length,
                                        itemBuilder: (_, i) => _RequestTile(
                                          order: orders[i],
                                          currency: currency,
                                          onTap: () =>
                                              _openRequest(orders[i], currency),
                                        ),
                                      ),
                              ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _hint(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
            child: Text(text, style: AppTypography.bodySecondary)),
      );
}

class _RequestTile extends StatelessWidget {
  const _RequestTile(
      {required this.order, required this.currency, required this.onTap});
  final Order order;
  final Currency currency;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: KayaCard(
        onTap: onTap,
        shadow: false,
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primaryTint,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.inventory_2_outlined,
                  color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(order.deliveryAddress,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyStrong),
                  Text(
                    order.distanceKm == null
                        ? order.pickupAddress
                        : '${order.distanceKm!.toStringAsFixed(1)} km',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
            if (order.minPriceSuggested != null)
              Text(Money(order.minPriceSuggested!, currency).format(),
                  style: AppTypography.bodyStrong),
          ],
        ),
      ),
    );
  }
}
