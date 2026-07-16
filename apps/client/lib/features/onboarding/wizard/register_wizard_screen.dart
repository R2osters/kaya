import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../login_screen.dart' show SocialSignupExtra;
import 'contact_step.dart';
import 'identity_step.dart';
import 'register_wizard_controller.dart';
import 'security_step.dart';

class RegisterWizardScreen extends ConsumerStatefulWidget {
  const RegisterWizardScreen({super.key, this.socialExtra});
  final SocialSignupExtra? socialExtra;

  @override
  ConsumerState<RegisterWizardScreen> createState() => _RegisterWizardScreenState();
}

class _RegisterWizardScreenState extends ConsumerState<RegisterWizardScreen> {
  int _step = 0;
  static const _totalSteps = 3;

  @override
  void initState() {
    super.initState();
    final extra = widget.socialExtra;
    if (extra != null) {
      // Social sign-ups skip straight to Contact (Identity's only field
      // beyond name — which is prefilled here too — is country, still asked).
      Future.microtask(() {
        ref.read(registerWizardProvider.notifier).prefillFromSocial(
          email: extra.email, fullName: extra.fullName, socialDraftToken: extra.socialDraftToken);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.authRegister)),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: LinearProgressIndicator(value: (_step + 1) / _totalSteps),
            ),
            Expanded(
              child: switch (_step) {
                0 => IdentityStep(onNext: () => setState(() => _step = 1)),
                1 => ContactStep(onNext: () => setState(() => _step = 2)),
                _ => const SecurityStep(),
              },
            ),
          ],
        ),
      ),
    );
  }
}
