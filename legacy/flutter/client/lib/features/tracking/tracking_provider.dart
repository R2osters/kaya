import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

class TrackingState {
  const TrackingState({
    this.delivery,
    this.driverLocation,
    this.loading = true,
    this.error,
  });

  final Delivery? delivery;
  final GeoPoint? driverLocation;
  final bool loading;
  final String? error;

  /// 0..3 for the timeline, refined by live status events.
  int get step {
    final s = delivery?.order?.status ?? OrderStatus.accepted;
    return switch (s) {
      OrderStatus.delivered => 3,
      OrderStatus.in_transit => 2,
      OrderStatus.picked_up => 1,
      _ => delivery?.timelineStep ?? 0,
    };
  }

  TrackingState copyWith({
    Delivery? delivery,
    GeoPoint? driverLocation,
    bool? loading,
    String? error,
  }) =>
      TrackingState(
        delivery: delivery ?? this.delivery,
        driverLocation: driverLocation ?? this.driverLocation,
        loading: loading ?? this.loading,
        error: error,
      );
}

/// Streams the driver's live position and delivery status for one delivery.
class TrackingController extends StateNotifier<TrackingState> {
  TrackingController(this._ref, this.deliveryId)
      : super(const TrackingState()) {
    _load();
    _listen();
  }

  final Ref _ref;
  final String deliveryId;
  StreamSubscription? _locSub;
  StreamSubscription? _statusSub;

  KayaApi get _api => _ref.read(kayaApiProvider);
  SocketService get _socket => _ref.read(socketServiceProvider);

  Future<void> _load() async {
    try {
      final delivery = await _api.deliveries.byId(deliveryId);
      state = state.copyWith(delivery: delivery, loading: false);
    } on ApiFailure catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    }
  }

  void _listen() {
    _socket.joinChat(deliveryId); // delivery room delivers location + status
    _locSub = _socket.onDriverLocation.listen((e) {
      if (mounted) {
        state = state.copyWith(driverLocation: GeoPoint(e.lat, e.lng));
      }
    });
    _statusSub = _socket.onDeliveryStatus.listen((e) {
      if (e.deliveryId == deliveryId) _load();
    });
  }

  Future<void> cancel(String reason) =>
      _api.deliveries.cancel(deliveryId, reason: reason);

  @override
  void dispose() {
    _locSub?.cancel();
    _statusSub?.cancel();
    super.dispose();
  }
}

final trackingControllerProvider = StateNotifierProvider.autoDispose
    .family<TrackingController, TrackingState, String>((ref, deliveryId) {
  return TrackingController(ref, deliveryId);
});
