import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../widgets/delivery_timeline.dart';
import 'tracking_provider.dart';

class TrackingScreen extends ConsumerWidget {
  const TrackingScreen({super.key, required this.deliveryId});
  final String deliveryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final state = ref.watch(trackingControllerProvider(deliveryId));
    final delivery = state.delivery;
    final order = delivery?.order;
    final driver = delivery?.driver;

    final markers = <MapMarker>[
      if (order != null) MapMarker.pickup(order.pickup),
      if (order != null) MapMarker.dropoff(order.dropoff),
      if (state.driverLocation != null) MapMarker.vehicle(state.driverLocation!),
    ];

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: MapView.build2(markers: markers, showUserLocation: true),
          ),
          SafeArea(
            child: Column(
              children: [
                // Order + timeline card.
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: KayaCard(
                    child: Column(
                      children: [
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back_rounded),
                              onPressed: () => context.go('/home'),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                order == null
                                    ? l10n.trackTitle
                                    : '${l10n.orderNumber} #${order.id.substring(0, 8).toUpperCase()}',
                                style: AppTypography.cardTitle,
                              ),
                            ),
                            StatusPill(
                              label: _stepLabel(l10n, state.step),
                              tone: state.step == 3
                                  ? StatusTone.success
                                  : StatusTone.primary,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        DeliveryTimeline(currentStep: state.step),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                // Driver card.
                if (driver != null)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: KayaCard(
                      child: Column(
                        children: [
                          Row(
                            children: [
                              KayaAvatar(
                                  photoUrl: driver.profilePhoto,
                                  name: driver.fullName,
                                  radius: 26),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(driver.fullName,
                                        style: AppTypography.cardTitle),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        const Icon(Icons.star_rounded,
                                            size: 15, color: AppColors.amber),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${driver.ratingDriver.toStringAsFixed(1)}  ·  ${driver.vehicleRegistration ?? driver.vehicleType?.name ?? ''}',
                                          style: AppTypography.caption,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.more_horiz_rounded),
                                onPressed: () =>
                                    _showActions(context, ref, l10n),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: KayaButton(
                                  label: l10n.actionChat,
                                  icon: Icons.chat_bubble_outline_rounded,
                                  variant: KayaButtonVariant.secondary,
                                  onPressed: () => context.push(
                                      '/chat/$deliveryId',
                                      extra: driver.fullName),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: KayaButton(
                                  label: l10n.actionCall,
                                  icon: Icons.phone_rounded,
                                  onPressed: () {},
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _stepLabel(KayaL10n l10n, int step) => switch (step) {
        3 => l10n.trackDelivered,
        2 => l10n.trackInTransit,
        1 => l10n.trackPickedUp,
        _ => l10n.trackEnRoute,
      };

  void _showActions(BuildContext context, WidgetRef ref, KayaL10n l10n) {
    showKayaBottomSheet(
      context: context,
      builder: (_) => BottomSheetShell(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.report_gmailerrorred_rounded,
                  color: AppColors.amber),
              title: Text(l10n.orderReportDispute),
              onTap: () {
                Navigator.pop(context);
                _reportDispute(context, l10n);
              },
            ),
            ListTile(
              leading: const Icon(Icons.cancel_outlined, color: AppColors.danger),
              title: Text(l10n.orderCancelTitle,
                  style: const TextStyle(color: AppColors.danger)),
              onTap: () {
                Navigator.pop(context);
                _confirmCancel(context, ref, l10n);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmCancel(
      BuildContext context, WidgetRef ref, KayaL10n l10n) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(l10n.orderCancelTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.orderCancelConfirm, style: AppTypography.bodySecondary),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: InputDecoration(hintText: l10n.cancelReason),
              maxLines: 3,
            ),
          ],
        ),
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
      await ref
          .read(trackingControllerProvider(deliveryId).notifier)
          .cancel(reasonController.text.trim());
      if (context.mounted) context.go('/home');
    } on ApiFailure catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  /// Report a dispute. The backend litigation endpoint is admin-only in v1
  /// (M5), so this collects the reason and acknowledges; wire to the dispute
  /// endpoint when it lands.
  Future<void> _reportDispute(BuildContext context, KayaL10n l10n) async {
    final reasonController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(l10n.orderReportDispute),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(hintText: l10n.cancelReason),
          maxLines: 4,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(l10n.actionClose)),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(l10n.actionSend)),
        ],
      ),
    );
    if (submitted == true && context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.disputeSubmitted)));
    }
  }
}
