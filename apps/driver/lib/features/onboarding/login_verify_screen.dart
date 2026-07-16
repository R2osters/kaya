import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

enum _Channel { none, sms, email }

/// Shown right after a successful password check. The user picks SMS or
/// email, then supplies whichever proof Firebase asks for.
class LoginVerifyScreen extends ConsumerStatefulWidget {
  const LoginVerifyScreen({super.key, required this.challengeId, required this.phone, required this.email});

  final String challengeId;
  final String phone;
  final String email;

  @override
  ConsumerState<LoginVerifyScreen> createState() => _LoginVerifyScreenState();
}

class _LoginVerifyScreenState extends ConsumerState<LoginVerifyScreen> {
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  final _emailAuth = FirebaseEmailLinkAuthService();
  _Channel _channel = _Channel.none;
  String? _verificationId;
  bool _emailLinkSent = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _pickSms() async {
    setState(() {
      _channel = _Channel.sms;
      _busy = true;
      _error = null;
    });
    await _phoneAuth.sendCode(
      phone: widget.phone,
      onCodeSent: (id) => setState(() {
        _verificationId = id;
        _busy = false;
      }),
      onError: (message) => setState(() {
        _error = message;
        _busy = false;
        _channel = _Channel.none;
      }),
    );
  }

  Future<void> _pickEmail() async {
    setState(() {
      _channel = _Channel.email;
      _busy = true;
      _error = null;
    });
    try {
      await _emailAuth.sendSignInLink(
        email: widget.email,
        continueUrl: 'https://kaya-a24e7.web.app/login-verify',
        androidPackageName: 'com.kaya.kaya_driver',
        iosBundleId: 'com.kaya.kayaDriver',
      );
      setState(() => _emailLinkSent = true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifySms() async {
    if (_verificationId == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(authControllerProvider.notifier).verifyLogin(
            challengeId: widget.challengeId,
            firebaseIdToken: idToken,
          );
      if (mounted) context.go('/home');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
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
            Text(l10n.authVerifyTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 8),
            Text(l10n.authVerifySubtitle, style: AppTypography.bodySecondary),
            const SizedBox(height: 24),
            if (_channel == _Channel.none) ...[
              KayaButton(
                label: l10n.authChannelSms,
                icon: Icons.sms_outlined,
                variant: KayaButtonVariant.secondary,
                onPressed: _pickSms,
              ),
              const SizedBox(height: 12),
              KayaButton(
                label: l10n.authChannelEmail,
                icon: Icons.mail_outline_rounded,
                variant: KayaButtonVariant.secondary,
                onPressed: _pickEmail,
              ),
            ] else if (_channel == _Channel.sms) ...[
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
              const SizedBox(height: 20),
              KayaButton(
                label: l10n.authVerify,
                loading: _busy,
                onPressed: _verificationId == null ? null : _verifySms,
              ),
            ] else if (_channel == _Channel.email) ...[
              if (_emailLinkSent)
                Text(l10n.authEmailLinkSent, style: AppTypography.bodySecondary)
              else
                const SizedBox.shrink(),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
          ],
        ),
      ),
    );
  }
}
