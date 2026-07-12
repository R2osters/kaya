import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/core_providers.dart';
import 'otp_screen.dart';

/// Client registration. On submit we request an OTP, then hand the payload to
/// the OTP screen which verifies and completes the registration.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  CountryCode _country = CountryCode.GHA;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final body = {
      'fullName': _name.text.trim(),
      'email': _email.text.trim(),
      'phone': _phone.text.trim(),
      'password': _password.text,
      'role': 'client',
      'countryCode': _country.wire,
    };
    try {
      await ref.read(kayaApiProvider).auth.sendOtp(
            phone: _phone.text.trim(),
            purpose: OtpPurpose.registration,
          );
      if (!mounted) return;
      context.push('/otp',
          extra: OtpArgs(phone: _phone.text.trim(), registerBody: body));
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
            Text(l10n.authRegister, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
                label: l10n.authFullName,
                controller: _name,
                prefixIcon: Icons.person_outline_rounded),
            const SizedBox(height: 16),
            KayaTextField(
                label: l10n.authEmail,
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.mail_outline_rounded),
            const SizedBox(height: 16),
            KayaTextField(
                label: l10n.authPhone,
                hint: '+233201234567',
                controller: _phone,
                keyboardType: TextInputType.phone,
                prefixIcon: Icons.phone_outlined),
            const SizedBox(height: 16),
            KayaTextField(
                label: l10n.authPassword,
                controller: _password,
                obscureText: true,
                prefixIcon: Icons.lock_outline_rounded),
            const SizedBox(height: 16),
            Text(l10n.authCountry, style: AppTypography.bodyStrong),
            const SizedBox(height: 8),
            _CountryPicker(
              value: _country,
              onChanged: (c) => setState(() => _country = c),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
                label: l10n.actionContinue, loading: _loading, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}

class _CountryPicker extends StatelessWidget {
  const _CountryPicker({required this.value, required this.onChanged});
  final CountryCode value;
  final ValueChanged<CountryCode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: CountryCode.values.map((c) {
        final active = c == value;
        return Expanded(
          child: GestureDetector(
            onTap: () => onChanged(c),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: active ? AppColors.primaryTint : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.field),
                border: Border.all(
                    color: active ? AppColors.primary : AppColors.border),
              ),
              child: Column(
                children: [
                  Text(c.flag, style: const TextStyle(fontSize: 20)),
                  const SizedBox(height: 4),
                  Text(c.displayName,
                      style: AppTypography.caption.copyWith(
                        color: active ? AppColors.primary : AppColors.inkSecondary,
                        fontWeight: FontWeight.w700,
                      )),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
