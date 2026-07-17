import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kaya_core/kaya_core.dart';

import '../login_screen.dart' show SocialSignupExtra;
import 'contact_step.dart';
import 'docs_metadata_step.dart';
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
  static const _totalSteps = 4;

  @override
  void initState() {
    super.initState();
    final extra = widget.socialExtra;
    if (extra != null) {
      // IdentityStep gets the social full name synchronously via a
      // constructor parameter below (widget.socialExtra is already
      // available here, no provider access needed), so it renders
      // correctly on the very first frame. The provider itself still needs
      // socialDraftToken/email/emailLocked/fullName populated for
      // ContactStep (watched later) and the final /auth/register payload —
      // that write can't happen synchronously here (Riverpod forbids
      // mutating provider state during initState/build), so it's deferred
      // to a microtask, which still completes well before ContactStep is
      // reached.
      Future.microtask(() {
        ref.read(registerWizardProvider.notifier).prefillFromSocial(
          email: extra.email, fullName: extra.fullName, socialDraftToken: extra.socialDraftToken);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // registerWizardProvider is `autoDispose`, and only ContactStep ever
    // `ref.watch`es it (IdentityStep/SecurityStep only `ref.read` it). With
    // no watcher kept alive for the screen's own lifetime, the provider's
    // listener count drops to zero the moment ContactStep unmounts — which
    // resets the draft to blank right before SecurityStep reads it to build
    // the /auth/register payload. Watching it here, at the wizard-shell
    // level, keeps it alive for as long as RegisterWizardScreen is mounted.
    ref.watch(registerWizardProvider);
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
                0 => IdentityStep(
                    onNext: () => setState(() => _step = 1),
                    initialFullName: widget.socialExtra?.fullName,
                  ),
                1 => ContactStep(onNext: () => setState(() => _step = 2)),
                2 => DocsMetadataStep(onNext: () => setState(() => _step = 3)),
                _ => const SecurityStep(),
              },
            ),
          ],
        ),
      ),
    );
  }
}
