import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../../providers/auth_provider.dart';
import 'register_wizard_controller.dart';

/// Last step: password (skipped for a social sign-up) + inline phone
/// verification, then the single POST /auth/register submit.
class SecurityStep extends ConsumerStatefulWidget {
  const SecurityStep({super.key});

  @override
  ConsumerState<SecurityStep> createState() => _SecurityStepState();
}

class _SecurityStepState extends ConsumerState<SecurityStep> {
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  String? _error;

  bool get _isSocial => ref.read(registerWizardProvider).socialDraftToken != null;

  @override
  void dispose() {
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = ref.read(registerWizardProvider).phone;
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: phone,
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _sending = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _sending = false;
      }),
    );
  }

  Future<void> _confirmAndSubmit() async {
    if (_verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      if (!_isSocial) {
        ref.read(registerWizardProvider.notifier).updatePassword(_password.text);
      }
      final draft = ref.read(registerWizardProvider);
      await ref.read(authControllerProvider.notifier).register(draft.toRegisterBody(idToken));
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = KayaL10n.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (!_isSocial) ...[
          KayaTextField(
            label: l10n.authPassword,
            controller: _password,
            obscureText: true,
            prefixIcon: Icons.lock_outline_rounded,
          ),
          const SizedBox(height: 16),
        ],
        if (_verificationId == null)
          KayaButton(
            label: l10n.authSendCode,
            loading: _sending,
            onPressed: _sending ? null : _sendCode,
          )
        else
          KayaTextField(
            label: l10n.authCode,
            controller: _code,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            prefixIcon: Icons.sms_outlined,
          ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.danger)),
        ],
        const SizedBox(height: 28),
        if (_verificationId != null)
          KayaButton(
            label: l10n.actionConfirm,
            loading: _loading,
            onPressed: _confirmAndSubmit,
          ),
      ],
    );
  }
}
