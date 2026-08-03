import 'package:flutter/material.dart';
import '../app_colors.dart';
import '../app_radii.dart';
import '../app_shadows.dart';
import '../app_typography.dart';

/// Bottom-sheet container with 28px top radius, grab handle, and optional title.
/// Use with [showKayaBottomSheet] for consistent presentation.
class BottomSheetShell extends StatelessWidget {
  const BottomSheetShell({
    super.key,
    required this.child,
    this.title,
    this.padding = const EdgeInsets.fromLTRB(20, 12, 20, 24),
  });

  final Widget child;
  final String? title;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
        boxShadow: AppShadows.sheet,
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: padding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
              ),
              if (title != null) ...[
                const SizedBox(height: 16),
                Text(title!, style: AppTypography.sectionTitle),
              ],
              const SizedBox(height: 16),
              Flexible(child: child),
            ],
          ),
        ),
      ),
    );
  }
}

/// Presents [builder] inside a [BottomSheetShell]-friendly modal route.
Future<T?> showKayaBottomSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: Colors.transparent,
    builder: builder,
  );
}
