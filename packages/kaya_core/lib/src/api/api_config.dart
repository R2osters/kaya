/// Runtime API configuration. The base URL comes from --dart-define so no host
/// is baked into the binary.
///
///   flutter run --dart-define=API_BASE_URL=http://localhost:3000
class ApiConfig {
  const ApiConfig({required this.baseUrl, this.apiPrefix = '/api/v1'});

  /// Origin only, e.g. http://localhost:3000 (no trailing slash, no prefix).
  final String baseUrl;

  /// Versioned REST prefix appended to [baseUrl] for REST calls.
  final String apiPrefix;

  String get restBaseUrl => '$_trimmedBase$apiPrefix';

  /// Socket.io connects to the origin (namespace handled by the gateway).
  String get socketUrl => _trimmedBase;

  String get _trimmedBase =>
      baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;

  /// Reads API_BASE_URL from the compile-time environment, defaulting to a
  /// local dev server. `10.0.2.2` is the Android emulator's host loopback.
  factory ApiConfig.fromEnvironment() {
    const url = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    );
    return const ApiConfig(baseUrl: url);
  }
}
