import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

class ChatState {
  const ChatState({this.messages = const [], this.loading = true});
  final List<Message> messages;
  final bool loading;

  ChatState copyWith({List<Message>? messages, bool? loading}) => ChatState(
        messages: messages ?? this.messages,
        loading: loading ?? this.loading,
      );
}

/// Loads a delivery's chat history and appends live `chat:message` events.
/// Sends via the socket (the gateway persists + rebroadcasts).
class ChatController extends StateNotifier<ChatState> {
  ChatController(this._ref, this.deliveryId) : super(const ChatState()) {
    _load();
    _listen();
  }

  final Ref _ref;
  final String deliveryId;
  StreamSubscription? _sub;

  KayaApi get _api => _ref.read(kayaApiProvider);
  SocketService get _socket => _ref.read(socketServiceProvider);

  Future<void> _load() async {
    try {
      final history = await _api.messages.list(deliveryId);
      state = state.copyWith(messages: history, loading: false);
    } on ApiFailure {
      state = state.copyWith(loading: false);
    }
  }

  void _listen() {
    _socket.joinChat(deliveryId);
    _sub = _socket.onChatMessage.listen((msg) {
      if (msg.deliveryId != deliveryId) return;
      if (state.messages.any((m) => m.id == msg.id)) return;
      state = state.copyWith(messages: [...state.messages, msg]);
    });
  }

  void send(String text) {
    if (text.trim().isEmpty) return;
    _socket.sendMessage(deliveryId, text: text.trim());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

final chatControllerProvider = StateNotifierProvider.autoDispose
    .family<ChatController, ChatState, String>((ref, deliveryId) {
  return ChatController(ref, deliveryId);
});
