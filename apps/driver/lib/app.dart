import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'providers/core_providers.dart';
import 'router.dart';

class KayaDriverApp extends ConsumerWidget {
  const KayaDriverApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      title: kAppName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: router,
      locale: locale,
      supportedLocales: KayaL10n.supportedLocales,
      localizationsDelegates: const [
        KayaL10n.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
