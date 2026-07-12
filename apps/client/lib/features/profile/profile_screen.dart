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
            style: AppTypography.sectionTitle.copyWith(color: AppColors.primary)),
        actions: [
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Center(child: LanguageToggle()),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: AppColors.primary),
            onPressed: () {},
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1),
        ),
      ),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Identity card
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
                            Text(user.phone, style: AppTypography.bodySecondary),
                            const SizedBox(height: 8),
                            if (user.isVerified)
                              StatusPill(
                                label: l10n.profileVerified,
                                tone: StatusTone.success,
                                icon: Icons.verified_rounded,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Rating card
                KayaCard(
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(user.ratingClient.toStringAsFixed(1),
                              style: AppTypography.screenTitle
                                  .copyWith(color: AppColors.primary, fontSize: 34)),
                          const SizedBox(width: 6),
                          const Icon(Icons.star_rounded,
                              color: AppColors.primary, size: 30),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(l10n.profileRating,
                          style: AppTypography.bodySecondary),
                      Text('(${l10n.profileDeliveries("${user.totalDeliveries}")})',
                          style: AppTypography.caption),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // ID verification
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
                      _verifyRow(l10n.profileGhanaCard, user.isVerified, l10n),
                      const Divider(height: 20),
                      _verifyRow(l10n.profileLicense, user.isVerified, l10n),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _linkTile(Icons.place_outlined, l10n.profileAddresses,
                    () => context.push('/address-search')),
                _linkTile(Icons.credit_card_outlined, l10n.profilePaymentMethods,
                    () {}),
                _CountryCurrencyTile(user: user, l10n: l10n),
                const SizedBox(height: 24),
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

  Widget _verifyRow(String label, bool approved, KayaL10n l10n) {
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

  Widget _linkTile(IconData icon, String label, VoidCallback onTap) {
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
            const Icon(Icons.chevron_right_rounded, color: AppColors.inkTertiary),
          ],
        ),
      ),
    );
  }
}

class _CountryCurrencyTile extends StatelessWidget {
  const _CountryCurrencyTile({required this.user, required this.l10n});
  final User user;
  final KayaL10n l10n;

  @override
  Widget build(BuildContext context) {
    return KayaCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Text(user.countryCode.flag, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.profileCountryCurrency,
                    style: AppTypography.overline),
                const SizedBox(height: 2),
                Text(
                    '${user.countryCode.displayName} · ${user.currency.symbol}',
                    style: AppTypography.bodyStrong),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
