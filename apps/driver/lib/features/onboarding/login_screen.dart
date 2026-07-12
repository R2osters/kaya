import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .login(_identifier.text.trim(), _password.text);
      if (mounted) context.go('/home');
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
            Text(l10n.authLogin, style: AppTypography.screenTitle),
            const SizedBox(height: 24),
            KayaTextField(
              label: '${l10n.authEmail} / ${l10n.authPhone}',
              controller: _identifier,
              keyboardType: TextInputType.emailAddress,
              prefixIcon: Icons.person_outline_rounded,
            ),
            const SizedBox(height: 16),
            KayaTextField(
              label: l10n.authPassword,
              controller: _password,
              obscureText: _obscure,
              prefixIcon: Icons.lock_outline_rounded,
              suffixIcon: IconButton(
                icon: Icon(
                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                    color: AppColors.inkTertiary),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(label: l10n.authLogin, loading: _loading, onPressed: _submit),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authRegister,
              variant: KayaButtonVariant.secondary,
              onPressed: () => context.push('/register'),
            ),
          ],
        ),
      ),
    );
  }
}
