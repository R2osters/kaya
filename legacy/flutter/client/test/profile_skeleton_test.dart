import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kaya_client/features/profile/profile_screen.dart';
import 'package:kaya_client/providers/auth_provider.dart';
import 'package:kaya_core/kaya_core.dart';

void main() {
  testWidgets('shows a KayaSkeletonCard while the user is null', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [currentUserProvider.overrideWithValue(null)],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: ProfileScreen(),
        ),
      ),
    );
    expect(find.byType(KayaSkeletonCard), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('shows the real profile once the user loads', (tester) async {
    const user = User(
      id: 'u1',
      email: 'kofi@example.com',
      phone: '+233201234567',
      fullName: 'Kofi Mensah',
      role: UserRole.client,
      countryCode: CountryCode.GHA,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [currentUserProvider.overrideWithValue(user)],
        child: const MaterialApp(
          localizationsDelegates: [KayaL10n.delegate],
          supportedLocales: KayaL10n.supportedLocales,
          home: ProfileScreen(),
        ),
      ),
    );
    expect(find.byType(KayaSkeletonCard), findsNothing);
    expect(find.text('Kofi Mensah'), findsOneWidget);
  });
}
