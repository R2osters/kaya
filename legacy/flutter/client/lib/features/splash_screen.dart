import 'package:flutter/material.dart';
import 'package:kaya_core/kaya_core.dart';

/// Shown while [AuthController] bootstraps the session on cold start.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              kAppName,
              style: AppTypography.screenTitle.copyWith(
                color: AppColors.surface,
                fontSize: 40,
              ),
            ),
            const SizedBox(height: 24),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation(AppColors.surface),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
