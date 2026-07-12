import 'json_utils.dart';

/// A delivery chat message. Handles BOTH shapes the backend uses:
///  - REST (camelCase): messageText, imageUrl, senderId, createdAt, isRead
///  - Socket 'chat:message' (snake_case): message_text, image_url, sender_id, created_at
class Message {
  const Message({
    required this.id,
    required this.deliveryId,
    required this.senderId,
    this.receiverId,
    this.messageText,
    this.imageUrl,
    this.isRead = false,
    required this.createdAt,
  });

  final String id;
  final String deliveryId;
  final String senderId;
  final String? receiverId;
  final String? messageText;
  final String? imageUrl;
  final bool isRead;
  final DateTime createdAt;

  bool get hasImage => imageUrl != null && imageUrl!.isNotEmpty;

  factory Message.fromJson(Map<String, dynamic> j) => Message(
        id: asString(j['id']),
        deliveryId: asString(j['deliveryId'] ?? j['delivery_id']),
        senderId: asString(j['senderId'] ?? j['sender_id']),
        receiverId: asStringOrNull(j['receiverId'] ?? j['receiver_id']),
        messageText: asStringOrNull(j['messageText'] ?? j['message_text']),
        imageUrl: asStringOrNull(j['imageUrl'] ?? j['image_url']),
        isRead: asBool(j['isRead'] ?? j['is_read']),
        createdAt: asDate(j['createdAt'] ?? j['created_at']),
      );
}
