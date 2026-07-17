import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import 'register_wizard_controller.dart';

class ContactStep extends ConsumerStatefulWidget {
  const ContactStep({super.key, required this.onNext});
  final VoidCallback onNext;

  @override
  ConsumerState<ContactStep> createState() => _ContactStepState();
}

class _ContactStepState extends ConsumerState<ContactStep> {
  late final _phone = TextEditingController(text: ref.read(registerWizardProvider).phone);
  late final _email = TextEditingController(text: ref.read(registerWizardProvider).email);

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    final locked = ref.watch(registerWizardProvider.select((d) => d.emailLocked));
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        KayaTextField(
          label: l10n.authPhone,
          hint: '+233201234567',
          controller: _phone,
          keyboardType: TextInputType.phone,
          prefixIcon: Icons.phone_outlined,
        ),
        const SizedBox(height: 16),
        KayaTextField(
          label: l10n.authEmail,
          controller: _email,
          enabled: !locked,
          keyboardType: TextInputType.emailAddress,
          prefixIcon: Icons.mail_outline_rounded,
        ),
        const SizedBox(height: 28),
        KayaButton(
          label: l10n.actionContinue,
          onPressed: () {
            ref.read(registerWizardProvider.notifier).updateContact(
              phone: _phone.text.trim(), email: _email.text.trim());
            widget.onNext();
          },
        ),
      ],
    );
  }
}
