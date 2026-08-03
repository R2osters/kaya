import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

/// Notification feed backed by GET /notifications (added in M5). Tapping an
/// item marks it read via PUT /notifications/:id/read.
final notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  return ref.read(kayaApiProvider).notifications.list();
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final async = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.notifTitle)),
      body: async.when(
        loading: () => const KayaSkeletonList(),
        error: (_, __) => EmptyState(
          icon: Icons.notifications_none_rounded,
          title: l10n.notifTitle,
          message: l10n.notifEmpty,
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              icon: Icons.notifications_none_rounded,
              title: l10n.notifTitle,
              message: l10n.notifEmpty,
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(indent: 72),
              itemBuilder: (_, i) {
                final n = items[i];
                return ListTile(
                  onTap: () async {
                    if (!n.isRead) {
                      await ref
                          .read(kayaApiProvider)
                          .notifications
                          .markRead(n.id);
                      ref.invalidate(notificationsProvider);
                    }
                  },
                  leading: CircleAvatar(
                    backgroundColor:
                        n.isRead ? AppColors.background : AppColors.primaryTint,
                    child: Icon(_iconFor(n.type),
                        color: n.isRead
                            ? AppColors.inkTertiary
                            : AppColors.primary),
                  ),
                  title: Text(n.title,
                      style: AppTypography.bodyStrong.copyWith(
                        fontWeight:
                            n.isRead ? FontWeight.w500 : FontWeight.w700,
                      )),
                  subtitle: Text(n.body, style: AppTypography.caption),
                  trailing: Text(
                    DateFormat('d MMM').format(n.createdAt),
                    style: AppTypography.caption,
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }

  IconData _iconFor(NotificationType t) => switch (t) {
        NotificationType.offer => Icons.local_offer_outlined,
        NotificationType.delivery => Icons.local_shipping_outlined,
        NotificationType.payment => Icons.payments_outlined,
        NotificationType.rating => Icons.star_outline_rounded,
        NotificationType.withdrawal => Icons.account_balance_wallet_outlined,
        NotificationType.order => Icons.receipt_long_outlined,
        NotificationType.system => Icons.info_outline_rounded,
      };
}
