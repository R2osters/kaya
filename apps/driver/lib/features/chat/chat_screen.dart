import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import 'chat_provider.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.deliveryId, this.peerName});
  final String deliveryId;
  final String? peerName;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send() {
    ref.read(chatControllerProvider(widget.deliveryId).notifier).send(_input.text);
    _input.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final state = ref.watch(chatControllerProvider(widget.deliveryId));
    final me = ref.watch(currentUserProvider)?.id;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            KayaAvatar(name: widget.peerName, radius: 18),
            const SizedBox(width: 10),
            Text(widget.peerName ?? l10n.inboxTitle,
                style: AppTypography.cardTitle),
          ],
        ),
        actions: [TextButton(onPressed: () {}, child: Text(l10n.actionCall))],
      ),
      body: Column(
        children: [
          Expanded(
            child: state.loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final m in state.messages)
                        _Bubble(message: m, mine: m.senderId == me),
                    ],
                  ),
          ),
          _Composer(controller: _input, hint: l10n.chatHint, onSend: _send),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine});
  final Message message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat('h:mm a').format(message.createdAt);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment:
            mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: mine ? AppColors.primary : AppColors.background,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(18),
                topRight: const Radius.circular(18),
                bottomLeft: Radius.circular(mine ? 18 : 4),
                bottomRight: Radius.circular(mine ? 4 : 18),
              ),
            ),
            child: Text(message.messageText ?? '',
                style: AppTypography.body.copyWith(
                    color: mine ? AppColors.surface : AppColors.ink)),
          ),
          const SizedBox(height: 4),
          Text(time, style: AppTypography.caption),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer(
      {required this.controller, required this.hint, required this.onSend});
  final TextEditingController controller;
  final String hint;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.borderSoft)),
        ),
        child: Row(
          children: [
            IconButton(
                icon: const Icon(Icons.photo_camera_outlined,
                    color: AppColors.inkSecondary),
                onPressed: () {}),
            Expanded(
              child: TextField(
                controller: controller,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: hint,
                  filled: true,
                  fillColor: AppColors.background,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: AppColors.primary,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onSend,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(Icons.send_rounded,
                      color: AppColors.surface, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
