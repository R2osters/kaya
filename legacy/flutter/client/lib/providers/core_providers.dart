import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

/// Runtime config from --dart-define (API_BASE_URL).
final apiConfigProvider = Provider<ApiConfig>((ref) {
  return ApiConfig.fromEnvironment();
});

/// Secure token storage (keystore / keychain).
final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStorage();
});

/// Central REST client. On session-expiry it flips [sessionExpiredProvider],
/// which the router redirect watches to bounce the user back to login.
final kayaApiProvider = Provider<KayaApi>((ref) {
  final api = KayaApi(
    config: ref.watch(apiConfigProvider),
    store: ref.watch(tokenStoreProvider),
    onSessionExpired: () async {
      ref.read(sessionExpiredProvider.notifier).state = true;
    },
  );
  return api;
});

/// Set when refresh fails; the router redirects to login.
final sessionExpiredProvider = StateProvider<bool>((ref) => false);

/// Shared realtime socket. Connected/disconnected by the auth controller.
final socketServiceProvider = Provider<SocketService>((ref) {
  final socket = SocketService(config: ref.watch(apiConfigProvider));
  ref.onDispose(socket.dispose);
  return socket;
});

/// UI locale (FR default). The FR/EN toggle updates this.
final localeProvider = StateProvider<Locale>((ref) => const Locale('fr'));

/// Device location service.
final locationServiceProvider = Provider<LocationService>((ref) {
  return LocationService();
});

/// Image compression helper for uploads.
final imageCompressionProvider = Provider<ImageCompression>((ref) {
  return const ImageCompression();
});
