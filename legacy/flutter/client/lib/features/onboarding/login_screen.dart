import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:kaya_core/kaya_core.dart';

import '../../providers/auth_provider.dart';

/// Payload handed to `/register` when a Google/Facebook sign-in found no
/// existing account. Consumed by the registration wizard (Wave 2b) once it
/// replaces the single-form RegisterScreen this currently routes to.
class SocialSignupExtra {
  const SocialSignupExtra({required this.socialDraftToken, required this.email, this.fullName});
  final String socialDraftToken;
  final String email;
  final String? fullName;
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  final _socialAuth = FirebaseSocialAuthService();
  bool _loading = false;
  bool _socialLoading = false;
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
      final challenge = await ref
          .read(authControllerProvider.notifier)
          .login(_identifier.text.trim(), _password.text);
      if (mounted) {
        context.push('/login-verify', extra: (
          challengeId: challenge.challengeId,
          identifier: _identifier.text.trim(),
        ));
      }
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signInWith(SocialProvider provider) async {
    setState(() {
      _socialLoading = true;
      _error = null;
    });
    try {
      final idToken = await _socialAuth.signIn(provider);
      if (idToken == null) return; // user cancelled
      final outcome = await ref
          .read(authControllerProvider.notifier)
          .socialLogin(idToken, provider.name);
      if (!mounted) return;
      switch (outcome) {
        case SocialLoginSuccess():
          context.go('/home');
        case SocialSignupRequired(:final socialDraftToken, :final email, :final fullName):
          context.push('/register', extra: SocialSignupExtra(
            socialDraftToken: socialDraftToken, email: email, fullName: fullName));
      }
    } on ApiFailure catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _socialLoading = false);
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
              hint: 'kofi@example.com',
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
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.push('/password-reset'),
                child: Text(l10n.authForgotPassword),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!,
                  style: AppTypography.caption.copyWith(color: AppColors.danger)),
            ],
            const SizedBox(height: 28),
            KayaButton(
              label: l10n.authLogin,
              loading: _loading,
              onPressed: _submit,
            ),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authRegister,
              variant: KayaButtonVariant.secondary,
              onPressed: () => context.push('/register'),
            ),
            const SizedBox(height: 24),
            Center(child: Text(l10n.authOrContinueWith, style: AppTypography.caption)),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authContinueWithGoogle,
              icon: Icons.g_mobiledata_rounded,
              variant: KayaButtonVariant.secondary,
              loading: _socialLoading,
              onPressed: () => _signInWith(SocialProvider.google),
            ),
            const SizedBox(height: 12),
            KayaButton(
              label: l10n.authContinueWithFacebook,
              icon: Icons.facebook_outlined,
              variant: KayaButtonVariant.secondary,
              loading: _socialLoading,
              onPressed: () => _signInWith(SocialProvider.facebook),
            ),
          ],
        ),
      ),
    );
  }
}
