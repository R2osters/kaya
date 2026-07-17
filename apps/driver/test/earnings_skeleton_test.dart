import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_driver/features/earnings/earnings_screen.dart';
import 'package:kaya_driver/providers/auth_provider.dart';
import 'package:kaya_driver/providers/core_providers.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets(
      'renders a bounded KayaSkeletonList while balance/earnings/stats load, '
      'without throwing the nested-unbounded-viewport error', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentUserProvider.overrideWithValue(null),
          kayaApiProvider.overrideWith((ref) => _HangingApi()),
        ],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: EarningsScreen(),
        ),
      ),
    );

    // EarningsScreen's own body is a ListView; KayaSkeletonList is itself an
    // unbounded ListView.builder. Without the SizedBox(height: 240) wrapper
    // this throws "Vertical viewport was given unbounded height" at layout.
    expect(tester.takeException(), isNull);
    // skipOffstage: false — the skeleton sits below the balance card and
    // commission tiers, past the default 600px test viewport, so the
    // default offstage-culling finder would miss it even though it rendered
    // (and laid out) successfully.
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

/// KayaApi stand-in whose driver.* calls never resolve, so the earnings
/// screen's FutureProviders stay in the loading state for the whole test.
class _HangingApi extends KayaApi {
  _HangingApi()
      : super(
          config: const ApiConfig(baseUrl: 'http://test.local'),
          store: InMemoryTokenStore(),
        );

  @override
  // ignore: overridden_fields
  late final DriverApi driver = _HangingDriverApi(this);
}

class _HangingDriverApi extends DriverApi {
  _HangingDriverApi(super.api);

  @override
  Future<Map<String, dynamic>> balance() =>
      Completer<Map<String, dynamic>>().future;

  @override
  Future<List<Transaction>> earnings() =>
      Completer<List<Transaction>>().future;

  @override
  Future<Map<String, dynamic>> stats() =>
      Completer<Map<String, dynamic>>().future;
}
