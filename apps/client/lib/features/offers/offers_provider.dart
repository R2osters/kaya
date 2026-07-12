import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

class OffersState {
  const OffersState({
    this.order,
    this.offers = const [],
    this.loading = true,
    this.error,
  });

  final Order? order;
  final List<Offer> offers;
  final bool loading;
  final String? error;

  OffersState copyWith({
    Order? order,
    List<Offer>? offers,
    bool? loading,
    String? error,
  }) =>
      OffersState(
        order: order ?? this.order,
        offers: offers ?? this.offers,
        loading: loading ?? this.loading,
        error: error,
      );
}

/// Loads an order's offers via REST, joins the order's socket room, and folds
/// live `offer:new` events into the list in real time.
class OffersController extends StateNotifier<OffersState> {
  OffersController(this._ref, this.orderId) : super(const OffersState()) {
    _load();
    _listen();
  }

  final Ref _ref;
  final String orderId;
  StreamSubscription? _newSub;

  KayaApi get _api => _ref.read(kayaApiProvider);
  SocketService get _socket => _ref.read(socketServiceProvider);

  Future<void> _load() async {
    try {
      final order = await _api.orders.byId(orderId);
      final offers = await _api.offers.forOrder(orderId);
      offers.sort((a, b) => a.proposedPrice.compareTo(b.proposedPrice));
      state = state.copyWith(order: order, offers: offers, loading: false);
    } on ApiFailure catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    }
  }

  void _listen() {
    _socket.joinOrder(orderId);
    _newSub = _socket.onOfferNew.listen((event) async {
      if (event.orderId != orderId) return;
      // Re-fetch the offer list so we get the embedded driver profile.
      final offers = await _api.offers.forOrder(orderId);
      offers.sort((a, b) => a.proposedPrice.compareTo(b.proposedPrice));
      if (mounted) state = state.copyWith(offers: offers);
    });
  }

  Future<Delivery> accept(String offerId) => _api.offers.accept(offerId);

  Future<void> refresh() => _load();

  @override
  void dispose() {
    _newSub?.cancel();
    super.dispose();
  }
}

final offersControllerProvider = StateNotifierProvider.autoDispose
    .family<OffersController, OffersState, String>((ref, orderId) {
  return OffersController(ref, orderId);
});
