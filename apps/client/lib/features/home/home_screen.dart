import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

/// Client home: full-screen map with a floating search and a bottom sheet of
/// primary actions. Mirrors the reference "accueil" screen.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      body: Stack(
        children: [
          // Full-screen map placeholder (real map when MAPS_API_KEY provided).
          Positioned.fill(
            child: MapView.build2(
              center: const GeoPoint(5.6037, -0.187),
              markers: const [],
              showUserLocation: true,
            ),
          ),

          // Top bar: brand + notification bell over the map.
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  _circleIcon(Icons.menu_rounded, () {}),
                  const Spacer(),
                  Text(kAppName,
                      style: AppTypography.sectionTitle
                          .copyWith(color: AppColors.primary)),
                  const Spacer(),
                  _circleIcon(Icons.notifications_none_rounded,
                      () => context.push('/notifications')),
                ],
              ),
            ),
          ),

          // Floating search stack.
          Positioned(
            top: 74,
            left: 16,
            right: 16,
            child: Column(
              children: [
                _SearchField(
                  icon: Icons.my_location_rounded,
                  text: user?.city ?? 'Osu Oxford Street',
                  trailing: Icons.close_rounded,
                  onTap: () {},
                ),
                const SizedBox(height: 10),
                _SearchField(
                  icon: Icons.place_outlined,
                  text: l10n.homeSearchHint,
                  muted: true,
                  onTap: () =>
                      context.push('/address-search', extra: l10n.orderDropoff),
                ),
              ],
            ),
          ),

          // Bottom action sheet.
          DraggableScrollableSheet(
            initialChildSize: 0.42,
            minChildSize: 0.42,
            maxChildSize: 0.85,
            builder: (context, controller) {
              return Container(
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
                  boxShadow: AppShadows.sheet,
                ),
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(AppRadii.pill),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(l10n.homeWhatMoving, style: AppTypography.screenTitle),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: _ActionCard(
                            icon: Icons.local_shipping_rounded,
                            label: l10n.homeNewDelivery,
                            primary: true,
                            onTap: () => context.push('/create-order'),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: _ActionCard(
                            icon: Icons.event_rounded,
                            label: l10n.homeScheduled,
                            onTap: () => context.go('/history'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    Text(l10n.homeRecentDropoffs, style: AppTypography.overline),
                    const SizedBox(height: 12),
                    _RecentTile(
                      title: 'East Legon ANC Mall',
                      subtitle: 'Accra',
                      onTap: () => context.push('/create-order'),
                    ),
                    _RecentTile(
                      title: 'Cantonments Post Office',
                      subtitle: 'Accra',
                      onTap: () => context.push('/create-order'),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _circleIcon(IconData icon, VoidCallback onTap) => Material(
        color: AppColors.surface,
        shape: const CircleBorder(),
        elevation: 0,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(icon, color: AppColors.ink),
          ),
        ),
      );
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.icon,
    required this.text,
    this.trailing,
    this.muted = false,
    this.onTap,
  });

  final IconData icon;
  final String text;
  final IconData? trailing;
  final bool muted;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.field),
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.field),
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.field),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: AppColors.inkTertiary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: muted
                      ? AppTypography.bodySecondary
                      : AppTypography.bodyStrong,
                ),
              ),
              if (trailing != null)
                Icon(trailing, size: 20, color: AppColors.inkTertiary),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.label,
    this.primary = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool primary;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final fg = primary ? AppColors.surface : AppColors.ink;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        height: 128,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: primary ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: primary ? null : Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: primary
                    ? AppColors.surface.withOpacity(0.18)
                    : AppColors.background,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: fg),
            ),
            Text(label,
                style: AppTypography.cardTitle.copyWith(color: fg, fontSize: 18)),
          ],
        ),
      ),
    );
  }
}

class _RecentTile extends StatelessWidget {
  const _RecentTile(
      {required this.title, required this.subtitle, this.onTap});
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: Container(
        width: 44,
        height: 44,
        decoration: const BoxDecoration(
          color: AppColors.background,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.history_rounded, color: AppColors.inkTertiary),
      ),
      title: Text(title, style: AppTypography.bodyStrong),
      subtitle: Text(subtitle, style: AppTypography.caption),
    );
  }
}
