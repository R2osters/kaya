import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../widgets/language_toggle.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = KayaL10n.of(context);
    final user = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.profileTitle,
            style:
                AppTypography.sectionTitle.copyWith(color: AppColors.primary)),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 12),
            child: Center(child: LanguageToggle()),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: user == null
          ? const KayaSkeletonCard()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                KayaCard(
                  child: Row(
                    children: [
                      KayaAvatar(
                          photoUrl: user.profilePhoto,
                          name: user.fullName,
                          radius: 34,
                          ring: true),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(user.fullName,
                                style: AppTypography.sectionTitle),
                            const SizedBox(height: 4),
                            Text(user.phone,
                                style: AppTypography.bodySecondary),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.star_rounded,
                                    size: 16, color: AppColors.amber),
                                const SizedBox(width: 4),
                                Text(
                                  '${user.ratingDriver.toStringAsFixed(1)} · ${l10n.profileDeliveries("${user.totalDeliveries}")}',
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Vehicle
                KayaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.two_wheeler_rounded,
                              color: AppColors.primary, size: 20),
                          const SizedBox(width: 8),
                          Text(l10n.driverVehicle,
                              style: AppTypography.cardTitle),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _row(l10n.driverVehicleType,
                          user.vehicleType?.name ?? '—'),
                      const Divider(height: 20),
                      _row(l10n.driverVehicleRegistration,
                          user.vehicleRegistration ?? '—'),
                      const Divider(height: 20),
                      _row(l10n.driverLicenseNumber,
                          user.driverLicenseNumber ?? '—'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Documents / verification
                KayaCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.verified_user_outlined,
                              color: AppColors.primary, size: 20),
                          const SizedBox(width: 8),
                          Text(l10n.profileIdVerification,
                              style: AppTypography.cardTitle),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _verify(l10n.profileGhanaCard, user.isVerified, l10n),
                      const Divider(height: 20),
                      _verify(l10n.profileLicense, user.isVerified, l10n),
                      const Divider(height: 20),
                      _verify(l10n.profileRegistration, user.isVerified, l10n),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Driver QR
                KayaCard(
                  child: Column(
                    children: [
                      Text(l10n.profileQrCode, style: AppTypography.cardTitle),
                      const SizedBox(height: 8),
                      Text(l10n.profileQrHint,
                          textAlign: TextAlign.center,
                          style: AppTypography.caption),
                      const SizedBox(height: 16),
                      Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(AppRadii.field),
                        ),
                        child: const Icon(Icons.qr_code_2_rounded,
                            size: 110, color: AppColors.ink),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _link(Icons.account_balance_wallet_outlined, l10n.navEarnings,
                    () => context.go('/earnings')),
                _link(Icons.insights_outlined, l10n.driverStats,
                    () => context.push('/stats')),
                _link(Icons.history_rounded, l10n.navHistory,
                    () => context.push('/history')),
                const SizedBox(height: 16),
                KayaButton(
                  label: l10n.authLogout,
                  variant: KayaButtonVariant.danger,
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).logout(),
                ),
              ],
            ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.bodySecondary),
        Text(value, style: AppTypography.bodyStrong),
      ],
    );
  }

  Widget _verify(String label, bool approved, KayaL10n l10n) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.body),
        StatusPill(
          label: approved ? l10n.profileApproved : l10n.profilePending,
          tone: approved ? StatusTone.success : StatusTone.neutral,
        ),
      ],
    );
  }

  Widget _link(IconData icon, String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: KayaCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: AppColors.inkSecondary, size: 20),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: AppTypography.bodyStrong)),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.inkTertiary),
          ],
        ),
      ),
    );
  }
}
