import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_core/kaya_core.dart';
import 'package:kaya_driver/features/home/new_request_popup.dart';

Order _sampleOrder() => Order.fromJson({
      'id': 'order-1',
      'clientId': 'c1',
      'pickupAddress': 'Osu Oxford Street, Accra',
      'pickupLat': 5.5560,
      'pickupLng': -0.1826,
      'deliveryAddress': 'East Legon ANC Mall, Accra',
      'deliveryLat': 5.6360,
      'deliveryLng': -0.1550,
      'status': 'published',
      'minPriceSuggested': '50.00',
      'createdAt': '2026-07-11T10:00:00.000Z',
    });

Widget _host(Widget child) => MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: const [
        KayaL10n.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: KayaL10n.supportedLocales,
      home: child,
    );

void main() {
  testWidgets('NewRequestPopup shows both legs, the suggested price and a countdown',
      (tester) async {
    final order = _sampleOrder();
    await tester.pumpWidget(_host(
      Builder(
        builder: (context) => TextButton(
          onPressed: () =>
              NewRequestPopup.show(context, order, Currency.GHS),
          child: const Text('open'),
        ),
      ),
    ));

    await tester.pumpAndSettle(); // localization delegates + button visible
    await tester.tap(find.text('open'));
    await tester.pump(); // show dialog (countdown timer now running)

    expect(find.text('Osu Oxford Street, Accra'), findsOneWidget);
    expect(find.text('East Legon ANC Mall, Accra'), findsOneWidget);
    expect(find.text('50.00 GHS'), findsOneWidget);
    // Countdown starts at 20.
    expect(find.text('20'), findsOneWidget);

    // Close so the countdown timer is cancelled before the test ends.
    await tester.tap(find.text('Refuser'));
    await tester.pumpAndSettle();
  });

  testWidgets('Accepting the popup resolves to true', (tester) async {
    final order = _sampleOrder();
    bool? result;
    await tester.pumpWidget(_host(
      Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            result = await NewRequestPopup.show(context, order, Currency.GHS);
          },
          child: const Text('open'),
        ),
      ),
    ));

    await tester.tap(find.text('open'));
    await tester.pump();

    // "Accepter" in FR.
    await tester.tap(find.text('Accepter'));
    await tester.pumpAndSettle();
    expect(result, isTrue);
  });

  testWidgets('Refusing the popup resolves to false', (tester) async {
    final order = _sampleOrder();
    bool? result;
    await tester.pumpWidget(_host(
      Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            result = await NewRequestPopup.show(context, order, Currency.GHS);
          },
          child: const Text('open'),
        ),
      ),
    ));

    await tester.tap(find.text('open'));
    await tester.pump();
    await tester.tap(find.text('Refuser'));
    await tester.pumpAndSettle();
    expect(result, isFalse);
  });
}
