import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../widgets/language_toggle.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(kAppName,
                      style: AppTypography.screenTitle
                          .copyWith(color: AppColors.primary, fontSize: 32)),
                  const LanguageToggle(),
                ],
              ),
              const Spacer(),
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: AppColors.primaryTint,
                  borderRadius: BorderRadius.circular(28),
                ),
                child: const Icon(Icons.local_shipping_outlined,
                    size: 48, color: AppColors.primary),
              ),
              const SizedBox(height: 32),
              Text(l10n.authWelcomeTitle, style: AppTypography.screenTitle),
              const SizedBox(height: 12),
              Text(l10n.authWelcomeSubtitle,
                  style: AppTypography.bodySecondary),
              const Spacer(),
              KayaButton(
                label: l10n.authLogin,
                onPressed: () => context.push('/login'),
              ),
              const SizedBox(height: 12),
              KayaButton(
                label: l10n.authRegister,
                variant: KayaButtonVariant.secondary,
                onPressed: () => context.push('/register'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
