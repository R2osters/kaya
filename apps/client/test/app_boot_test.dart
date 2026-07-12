import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/app.dart';
import 'package:kaya_client/providers/core_providers.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets('boots to the welcome screen when no session token is stored',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Avoid the platform secure-storage channel; start signed out.
          tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
        ],
        child: const KayaClientApp(),
      ),
    );

    // Splash -> auth bootstrap (no token) -> redirect to /welcome.
    await tester.pumpAndSettle();

    // FR welcome CTAs.
    expect(find.text('Se connecter'), findsOneWidget);
    expect(find.text('Créer un compte'), findsOneWidget);
  });
}
