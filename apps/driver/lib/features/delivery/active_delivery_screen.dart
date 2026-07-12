import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

final _deliveryProvider =
    FutureProvider.autoDispose.family<Delivery, String>((ref, id) async {
  return ref.read(kayaApiProvider).deliveries.byId(id);
});

/// Driver-side execution of a delivery: en route -> picked up -> in transit ->
/// delivered. The pickup photo is camera-only per the spec.
class ActiveDeliveryScreen extends ConsumerStatefulWidget {
  const ActiveDeliveryScreen({super.key, required this.deliveryId});
  final String deliveryId;

  @override
  ConsumerState<ActiveDeliveryScreen> createState() =>
      _ActiveDeliveryScreenState();
}

class _ActiveDeliveryScreenState extends ConsumerState<ActiveDeliveryScreen> {
  bool _busy = false;

  KayaApi get _api => ref.read(kayaApiProvider);

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(_deliveryProvider(widget.deliveryId));
    } on ApiFailure catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _capturePickupPhoto() async {
    // Camera only — the driver must photograph the package at pickup.
    final shot = await ImagePicker().pickImage(source: ImageSource.camera);
    if (shot == null) return null;
    await ref.read(imageCompressionProvider).compress(File(shot.path));
    // Upload wiring returns a URL in production; the local path stands in here.
    return shot.path;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final async = ref.watch(_deliveryProvider(widget.deliveryId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.driverActiveDelivery)),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(child: Text(l10n.commonError)),
        data: (delivery) {
          final order = delivery.order;
          final status = order?.status ?? OrderStatus.accepted;
          final markers = <MapMarker>[
            if (order != null) MapMarker.pickup(order.pickup),
            if (order != null) MapMarker.dropoff(order.dropoff),
          ];
          return Column(
            children: [
              SizedBox(
                height: 240,
                child: MapView.build2(markers: markers, showUserLocation: true),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _leg(Icons.trip_origin_rounded, AppColors.success,
                        l10n.orderPickup, order?.pickupAddress ?? '—'),
                    const SizedBox(height: 8),
                    _leg(Icons.place_rounded, AppColors.primary,
                        l10n.orderDropoff, order?.deliveryAddress ?? '—'),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: KayaButton(
                            label: l10n.actionChat,
                            icon: Icons.chat_bubble_outline_rounded,
                            variant: KayaButtonVariant.secondary,
                            onPressed: () =>
                                context.push('/chat/${delivery.id}'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: KayaButton(
                            label: l10n.actionCall,
                            icon: Icons.phone_rounded,
                            variant: KayaButtonVariant.secondary,
                            onPressed: () {},
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              _ActionBar(
                status: status,
                busy: _busy,
                l10n: l10n,
                onStart: () => _run(() => _api.deliveries.start(delivery.id)),
                onPickup: () => _run(() async {
                  final photo = await _capturePickupPhoto();
                  await _api.deliveries.pickup(delivery.id, photoUrl: photo);
                }),
                onTransit: () =>
                    _run(() => _api.deliveries.transit(delivery.id)),
                onDeliver: () => _run(() async {
                  await _api.deliveries.confirmDelivery(delivery.id);
                  if (context.mounted) context.push('/rating/${delivery.id}');
                }),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _leg(IconData icon, Color color, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: AppTypography.overline),
              const SizedBox(height: 2),
              Text(value, style: AppTypography.bodyStrong),
            ],
          ),
        ),
      ],
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.status,
    required this.busy,
    required this.l10n,
    required this.onStart,
    required this.onPickup,
    required this.onTransit,
    required this.onDeliver,
  });

  final OrderStatus status;
  final bool busy;
  final KayaL10n l10n;
  final VoidCallback onStart;
  final VoidCallback onPickup;
  final VoidCallback onTransit;
  final VoidCallback onDeliver;

  @override
  Widget build(BuildContext context) {
    final (label, action, icon) = switch (status) {
      OrderStatus.accepted ||
      OrderStatus.offers_received =>
        (l10n.trackEnRoute, onStart, Icons.navigation_rounded),
      OrderStatus.driver_en_route => (
          l10n.driverTakePickupPhoto,
          onPickup,
          Icons.photo_camera_rounded
        ),
      OrderStatus.picked_up => (
          l10n.trackInTransit,
          onTransit,
          Icons.local_shipping_rounded
        ),
      OrderStatus.in_transit => (
          l10n.trackDelivered,
          onDeliver,
          Icons.check_circle_rounded
        ),
      _ => (l10n.trackDelivered, null, Icons.check_circle_rounded),
    };

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: KayaButton(
          label: label,
          icon: icon,
          loading: busy,
          onPressed: action,
        ),
      ),
    );
  }
}
