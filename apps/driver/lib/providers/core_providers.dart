import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

/// Runtime config from --dart-define (API_BASE_URL).
final apiConfigProvider = Provider<ApiConfig>((ref) {
  return ApiConfig.fromEnvironment();
});

final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStorage();
});

final sessionExpiredProvider = StateProvider<bool>((ref) => false);

final kayaApiProvider = Provider<KayaApi>((ref) {
  return KayaApi(
    config: ref.watch(apiConfigProvider),
    store: ref.watch(tokenStoreProvider),
    onSessionExpired: () async {
      ref.read(sessionExpiredProvider.notifier).state = true;
    },
  );
});

final socketServiceProvider = Provider<SocketService>((ref) {
  final socket = SocketService(config: ref.watch(apiConfigProvider));
  ref.onDispose(socket.dispose);
  return socket;
});

final localeProvider = StateProvider<Locale>((ref) => const Locale('fr'));

final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService();
});

final imageCompressionProvider = Provider<ImageCompression>((ref) {
  return const ImageCompression();
});
