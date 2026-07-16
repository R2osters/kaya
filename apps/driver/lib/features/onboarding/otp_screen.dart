import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class OtpArgs {
  const OtpArgs({this.phone, this.email, required this.registerBody});
  final String? phone;
  final String? email;
  final Map<String, dynamic> registerBody;
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs? args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  final _phoneAuth = FirebasePhoneAuthService();
  String? _verificationId;
  bool _sending = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _sendCode();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = widget.args?.phone;
    if (phone == null) return;
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

  Future<void> _verifyAndRegister() async {
    final args = widget.args;
    if (args == null || _verificationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final idToken = await _phoneAuth.confirmCode(
        verificationId: _verificationId!,
        smsCode: _code.text.trim(),
      );
      await ref.read(authControllerProvider.notifier).register({
        ...args.registerBody,
        'firebaseIdToken': idToken,
      });
      // New drivers land on document verification before the home.
      if (mounted) context.go('/verify-documents');
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
            Text(l10n.authOtpTitle, style: AppTypography.screenTitle),
            const SizedBox(height: 8),
            Text(l10n.authOtpSubtitle, style: AppTypography.bodySecondary),
            const SizedBox(height: 28),
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
                label: l10n.authVerify,
                loading: _loading || _sending,
                onPressed:
                    (_sending || _verificationId == null) ? null : _verifyAndRegister),
          ],
        ),
      ),
    );
  }
}
