import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_driver/features/home/driver_home_screen.dart';
import 'package:kaya_driver/features/home/nearby_provider.dart';
import 'package:kaya_driver/providers/auth_provider.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets(
      'renders a bounded KayaSkeletonList while nearby orders load, without '
      'throwing the nested-unbounded-viewport error (regression guard)',
      (tester) async {
    const user = User(
      id: 'd1',
      email: 'driver@example.com',
      phone: '+233201234567',
      fullName: 'Kwame Driver',
      role: UserRole.livreur,
      countryCode: CountryCode.GHA,
      isOnline: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentUserProvider.overrideWithValue(user),
          // Never resolves, so the nearby-requests sheet stays in the
          // loading branch for the whole test.
          nearbyOrdersProvider.overrideWith((ref) => Completer<List<Order>>().future),
          driverStatsProvider.overrideWith(
              (ref) => Completer<Map<String, dynamic>>().future),
        ],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: DriverHomeScreen(),
        ),
      ),
    );

    // The nearby-requests sheet already wraps KayaSkeletonList in
    // SizedBox(height: 280) — this test guards against that regressing.
    expect(tester.takeException(), isNull);
    // skipOffstage: false — the sheet's Flexible/ListView.builder content can
    // sit past the default test viewport even though it rendered and laid
    // out successfully.
    final skeleton = find.byType(KayaSkeletonList, skipOffstage: false);
    expect(skeleton, findsOneWidget);
    expect(
      find.ancestor(
        of: skeleton,
        matching: find.byWidgetPredicate(
            (w) => w is SizedBox && w.height == 280,
            skipOffstage: false),
      ),
      findsOneWidget,
    );
  });
}
