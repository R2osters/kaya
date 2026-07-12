import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';
import '../../providers/core_providers.dart';

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
  // No pre-fill: the dev provider logs a real random code to the backend
  // console (`[DEV OTP] code for X is: NNNNNN`) — type that value here.
  final _code = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _verifyAndRegister() async {
    final args = widget.args;
    if (args == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(kayaApiProvider).auth.verifyOtp(
            phone: args.phone,
            email: args.email,
            code: _code.text.trim(),
            purpose: OtpPurpose.registration,
          );
      await ref.read(authControllerProvider.notifier).register(args.registerBody);
      // New drivers land on document verification before the home.
      if (mounted) context.go('/verify-documents');
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
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
              label: 'Code',
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
                loading: _loading,
                onPressed: _verifyAndRegister),
          ],
        ),
      ),
    );
  }
}
