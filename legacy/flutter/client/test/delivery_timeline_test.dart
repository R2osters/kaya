import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/widgets/delivery_timeline.dart';
import 'package:kaya_core/kaya_core.dart';

Widget _host(Widget child) => MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: const [
        KayaL10n.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: KayaL10n.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('DeliveryTimeline renders the four localized steps',
      (tester) async {
    await tester.pumpWidget(_host(const DeliveryTimeline(currentStep: 2)));
    await tester.pumpAndSettle(); // let localization delegates load

    // FR labels for en route / picked up / on the way / delivered.
    expect(find.text('En route'), findsOneWidget);
    expect(find.text('Récupéré'), findsOneWidget);
    expect(find.text('En cours'), findsOneWidget);
    expect(find.text('Livré'), findsOneWidget);
  });

  testWidgets('completed steps show check marks up to the current step',
      (tester) async {
    await tester.pumpWidget(_host(const DeliveryTimeline(currentStep: 2)));
    await tester.pumpAndSettle();
    // Steps 0 and 1 are done -> two check icons.
    expect(find.byIcon(Icons.check_rounded), findsNWidgets(2));
  });
}
