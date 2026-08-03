import 'package:dio/dio.dart';

/// Typed failure surfaced to the UI. Maps Dio/HTTP errors to user-meaningful
/// categories so screens can react (e.g. show a re-login prompt on [unauthorized]).
enum FailureKind {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  server,
  cancelled,
  unknown,
}

class ApiFailure implements Exception {
  const ApiFailure({
    required this.kind,
    required this.message,
    this.statusCode,
    this.fieldErrors,
  });

  final FailureKind kind;
  final String message;
  final int? statusCode;

  /// Field-level messages from class-validator (`{ field: [msgs] }`).
  final Map<String, List<String>>? fieldErrors;

  bool get isAuth => kind == FailureKind.unauthorized;

  factory ApiFailure.from(Object error) {
    if (error is ApiFailure) return error;
    if (error is! DioException) {
      return ApiFailure(kind: FailureKind.unknown, message: error.toString());
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiFailure(
          kind: FailureKind.timeout,
          message: 'The request timed out. Check your connection and retry.',
        );
      case DioExceptionType.cancel:
        return const ApiFailure(
          kind: FailureKind.cancelled,
          message: 'Request cancelled.',
        );
      case DioExceptionType.connectionError:
        return const ApiFailure(
          kind: FailureKind.network,
          message: 'Unable to reach the server. Are you online?',
        );
      case DioExceptionType.badCertificate:
        return const ApiFailure(
          kind: FailureKind.network,
          message: 'Secure connection failed.',
        );
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        return _fromResponse(error);
      // Future DioExceptionType values (e.g. transformTimeout) degrade safely.
      // ignore: unreachable_switch_default
      default:
        return _fromResponse(error);
    }
  }

  static ApiFailure _fromResponse(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    final serverMessage = _extractMessage(data);
    final fields = _extractFieldErrors(data);

    final kind = switch (status) {
      401 => FailureKind.unauthorized,
      403 => FailureKind.forbidden,
      404 => FailureKind.notFound,
      409 => FailureKind.conflict,
      422 || 400 => FailureKind.validation,
      _ => (status != null && status >= 500)
          ? FailureKind.server
          : FailureKind.unknown,
    };

    return ApiFailure(
      kind: kind,
      statusCode: status,
      message: serverMessage ?? _defaultMessage(kind),
      fieldErrors: fields,
    );
  }

  static String? _extractMessage(dynamic data) {
    if (data is Map) {
      final msg = data['message'];
      if (msg is String) return msg;
      if (msg is List && msg.isNotEmpty) return msg.first.toString();
      if (data['error'] is String) return data['error'] as String;
    }
    return null;
  }

  static Map<String, List<String>>? _extractFieldErrors(dynamic data) {
    // NestJS class-validator returns message as a flat array of strings.
    if (data is Map && data['message'] is List) {
      return {
        '_': (data['message'] as List).map((e) => e.toString()).toList(),
      };
    }
    return null;
  }

  static String _defaultMessage(FailureKind kind) => switch (kind) {
        FailureKind.unauthorized => 'Your session has expired. Please sign in again.',
        FailureKind.forbidden => 'You are not allowed to do that.',
        FailureKind.notFound => 'Not found.',
        FailureKind.conflict => 'That action conflicts with the current state.',
        FailureKind.validation => 'Please check the information you entered.',
        FailureKind.server => 'Something went wrong on our side. Try again shortly.',
        _ => 'Something went wrong.',
      };

  @override
  String toString() => 'ApiFailure($kind, $statusCode): $message';
}
