import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class LoginOtpScreen extends ConsumerStatefulWidget {
  const LoginOtpScreen({super.key});

  @override
  ConsumerState<LoginOtpScreen> createState() => _LoginOtpScreenState();
}

class _LoginOtpScreenState extends ConsumerState<LoginOtpScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
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

  Future<void> _verifyAndLogin() async {
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
      await ref
          .read(authControllerProvider.notifier)
          .loginWithOtp(_phone.text.trim(), idToken);
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
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(l10n.authLoginOtp, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: l10n.authPhone,
              hint: '+233****4567',
              controller: _phone,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
            ),
            const SizedBox(height: 16),
            if (_verificationId != null)
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
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: _verificationId == null ? l10n.authSendCode : l10n.authVerify,
              loading: _sending || _loading,
              onPressed: _verificationId == null ? _sendCode : _verifyAndLogin,
            ),
          ],
        ),
      ),
    );
  }
}
