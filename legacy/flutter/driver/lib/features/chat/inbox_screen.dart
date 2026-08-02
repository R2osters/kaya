import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

/// Driver conversations: the client on each of the driver's deliveries.
final inboxProvider = FutureProvider.autoDispose<List<Delivery>>((ref) async {
  return ref.read(kayaApiProvider).deliveries.mine();
});

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final async = ref.watch(inboxProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.inboxTitle)),
      body: async.when(
        loading: () => const KayaSkeletonList(),
        error: (_, __) => Center(child: Text(l10n.commonError)),
        data: (deliveries) {
          if (deliveries.isEmpty) {
            return EmptyState(
              icon: Icons.chat_bubble_outline_rounded,
              title: l10n.inboxTitle,
              message: l10n.inboxEmpty,
            );
          }
          return ListView.separated(
            itemCount: deliveries.length,
            separatorBuilder: (_, __) => const Divider(indent: 76),
            itemBuilder: (_, i) {
              final d = deliveries[i];
              final peer = d.order?.deliveryAddress ?? l10n.clientLabel;
              return ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                leading: KayaAvatar(name: l10n.clientLabel, radius: 24),
                title: Text(l10n.clientLabel, style: AppTypography.bodyStrong),
                subtitle: Text(peer,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption),
                trailing: const Icon(Icons.chevron_right_rounded,
                    color: AppColors.inkTertiary),
                onTap: () =>
                    context.push('/chat/${d.id}', extra: l10n.clientLabel),
              );
            },
          );
        },
      ),
    );
  }
}
