import 'enums.dart';
import 'json_utils.dart';

/// An in-app notification. Mirrors backend `notifications`.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.data,
    this.readAt,
    required this.createdAt,
  });

  final String id;
  final NotificationType type;
  final String title;
  final String body;
  final Map<String, dynamic>? data;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isRead => readAt != null;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: asString(j['id']),
        type: notificationTypeFromWire(j['type'] as String?),
        title: asString(j['title']),
        body: asString(j['body']),
        data: j['data'] is Map ? asMap(j['data']) : null,
        readAt: asDateOrNull(j['readAt']),
        createdAt: asDate(j['createdAt']),
      );
}
