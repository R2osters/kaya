import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';
import '../../widgets/brand_app_bar.dart';

/// Conversations = the user's deliveries that have a counterpart to chat with.
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
      appBar: const BrandAppBar(),
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
              final peer = d.driver?.fullName ?? 'Livreur';
              return ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                leading: KayaAvatar(
                    photoUrl: d.driver?.profilePhoto, name: peer, radius: 24),
                title: Text(peer, style: AppTypography.bodyStrong),
                subtitle: Text(
                  '#${d.orderId.substring(0, 8).toUpperCase()}',
                  style: AppTypography.caption,
                ),
                trailing: const Icon(Icons.chevron_right_rounded,
                    color: AppColors.inkTertiary),
                onTap: () => context.push('/chat/${d.id}', extra: peer),
              );
            },
          );
        },
      ),
    );
  }
}
