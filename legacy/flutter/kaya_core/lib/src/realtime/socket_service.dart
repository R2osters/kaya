import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api/api_config.dart';
import '../models/message.dart';
import 'socket_events.dart';

/// Realtime connection to the NestJS Socket.io gateway.
///
/// The access token is sent in the handshake `auth.token` (the gateway reads
/// `handshake.auth.token`). Exposes typed broadcast streams; UI layers listen
/// to the ones they need. Emits: order:join, chat:join, chat:message,
/// location:update.
class SocketService {
  SocketService({required this.config});

  final ApiConfig config;
  io.Socket? _socket;

  final _offerNew = StreamController<OfferNewEvent>.broadcast();
  final _offerAccepted = StreamController<OfferAcceptedEvent>.broadcast();
  final _driverLocation = StreamController<DriverLocationEvent>.broadcast();
  final _chatMessage = StreamController<Message>.broadcast();
  final _deliveryStatus = StreamController<DeliveryStatusEvent>.broadcast();
  final _connection = StreamController<bool>.broadcast();

  Stream<OfferNewEvent> get onOfferNew => _offerNew.stream;
  Stream<OfferAcceptedEvent> get onOfferAccepted => _offerAccepted.stream;
  Stream<DriverLocationEvent> get onDriverLocation => _driverLocation.stream;
  Stream<Message> get onChatMessage => _chatMessage.stream;
  Stream<DeliveryStatusEvent> get onDeliveryStatus => _deliveryStatus.stream;
  Stream<bool> get onConnectionChange => _connection.stream;

  bool get isConnected => _socket?.connected ?? false;

  /// Opens the connection with the current access token. Safe to call again
  /// after a token refresh — it tears down and reconnects with the new token.
  void connect(String accessToken) {
    disconnect();
    final socket = io.io(
      config.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': accessToken})
          .enableReconnection()
          .build(),
    );

    socket.onConnect((_) => _connection.add(true));
    socket.onDisconnect((_) => _connection.add(false));
    socket.onConnectError((_) => _connection.add(false));

    socket.on('offer:new',
        (d) => _safe(d, (m) => _offerNew.add(OfferNewEvent.fromJson(m))));
    socket.on(
        'offer:accepted',
        (d) => _safe(
            d, (m) => _offerAccepted.add(OfferAcceptedEvent.fromJson(m))));
    socket.on(
        'location:driver',
        (d) => _safe(
            d, (m) => _driverLocation.add(DriverLocationEvent.fromJson(m))));
    socket.on('chat:message',
        (d) => _safe(d, (m) => _chatMessage.add(Message.fromJson(m))));
    socket.on(
        'delivery:status',
        (d) => _safe(
            d, (m) => _deliveryStatus.add(DeliveryStatusEvent.fromJson(m))));

    socket.connect();
    _socket = socket;
  }

  // --- Emitters (client -> server) ---

  /// Watch an order's offer stream (client owner or a bidding driver).
  void joinOrder(String orderId) =>
      _socket?.emit('order:join', {'order_id': orderId});

  /// Join a delivery's chat + tracking room.
  void joinChat(String deliveryId) =>
      _socket?.emit('chat:join', {'delivery_id': deliveryId});

  /// Send a chat message (persisted + broadcast by the gateway).
  void sendMessage(String deliveryId, {String? text, String? imageUrl}) {
    _socket?.emit('chat:message', {
      'delivery_id': deliveryId,
      if (text != null) 'message_text': text,
      if (imageUrl != null) 'image_url': imageUrl,
    });
  }

  /// Driver position tick (every ~5s). Server throttles the Postgres flush.
  void sendLocation(double lat, double lng) =>
      _socket?.emit('location:update', {'lat': lat, 'lng': lng});

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  void _safe(dynamic data, void Function(Map<String, dynamic>) handle) {
    if (data is Map) {
      handle(Map<String, dynamic>.from(data));
    }
  }

  Future<void> dispose() async {
    disconnect();
    await _offerNew.close();
    await _offerAccepted.close();
    await _driverLocation.close();
    await _chatMessage.close();
    await _deliveryStatus.close();
    await _connection.close();
  }
}
