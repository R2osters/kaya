import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/features/offers/offers_screen.dart';
import 'package:kaya_client/providers/core_providers.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets(
      'renders a bounded KayaSkeletonList while offers are loading, without '
      'throwing the nested-unbounded-viewport error (regression guard)',
      (tester) async {
    const orderId = 'order-1';

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // orders.byId / offers.forOrder never resolve, so OffersController
          // stays on its initial OffersState (loading: true) for the test.
          kayaApiProvider.overrideWith((ref) => _HangingApi()),
        ],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: OffersScreen(orderId: orderId),
        ),
      ),
    );

    // OffersScreen's own body is a ListView; KayaSkeletonList is itself an
    // unbounded ListView.builder. This screen already wraps it in
    // SizedBox(height: 240) — this test guards against that regressing.
    expect(tester.takeException(), isNull);
    // skipOffstage: false — the skeleton can sit past the default test
    // viewport height depending on content above it, even though it
    // rendered and laid out successfully.
    final skeleton = find.byType(KayaSkeletonList, skipOffstage: false);
    expect(skeleton, findsOneWidget);
    expect(
      find.ancestor(
        of: skeleton,
        matching: find.byWidgetPredicate(
            (w) => w is SizedBox && w.height == 240,
            skipOffstage: false),
      ),
      findsOneWidget,
    );
  });
}

/// KayaApi stand-in whose orders/offers calls never resolve. SocketService
/// is left un-stubbed since OffersController never calls connect() — its
/// joinOrder()/onOfferNew are safe no-ops without a live socket.
class _HangingApi extends KayaApi {
  _HangingApi()
      : super(
          config: const ApiConfig(baseUrl: 'http://test.local'),
          store: InMemoryTokenStore(),
        );

  @override
  // ignore: overridden_fields
  late final OrdersApi orders = _HangingOrdersApi(this);

  @override
  // ignore: overridden_fields
  late final OffersApi offers = _HangingOffersApi(this);
}

class _HangingOrdersApi extends OrdersApi {
  _HangingOrdersApi(super.api);

  @override
  Future<Order> byId(String id) => Completer<Order>().future;
}

class _HangingOffersApi extends OffersApi {
  _HangingOffersApi(super.api);

  @override
  Future<List<Offer>> forOrder(String orderId) => Completer<List<Offer>>().future;
}
