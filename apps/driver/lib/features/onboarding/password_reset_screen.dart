import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';

class PasswordResetScreen extends ConsumerStatefulWidget {
  const PasswordResetScreen({super.key});

  @override
  ConsumerState<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends ConsumerState<PasswordResetScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: _phone.text.trim(),
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

  Future<void> _confirmAndReset() async {
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
      await ref.read(kayaApiProvider).auth.resetPassword(
            phone: _phone.text.trim(),
            firebaseIdToken: idToken,
            newPassword: _newPassword.text,
          );
      setState(() => _done = true);
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
    if (_done) {
      return Scaffold(
        appBar: AppBar(),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.authResetPasswordSuccess, style: AppTypography.bodyStrong),
                const SizedBox(height: 24),
                KayaButton(
                  label: l10n.authLogin,
                  onPressed: () => context.go('/login'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authResetPasswordTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: l10n.authPhone,
              hint: '+233****4567',
              controller: _phone,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 16),
            if (_verificationId != null) ...[
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
              const SizedBox(height: 16),
              KayaTextField(
                label: l10n.authNewPassword,
                controller: _newPassword,
                obscureText: true,
                prefixIcon: Icons.lock_outline_rounded,
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: _verificationId == null ? l10n.authSendCode : l10n.actionConfirm,
              loading: _sending || _loading,
              onPressed: _verificationId == null ? _sendCode : _confirmAndReset,
            ),
          ],
        ),
      ),
    );
  }
}
